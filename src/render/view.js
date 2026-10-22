// three.js 畫面：只負責把 Game 的狀態畫出來，不改遊戲規則
import * as THREE from 'three';
import { buildMesh, blockMesh } from './mesher.js';
import { CRACK_STAGES } from '../mining.js';
import { DROP_SIZE } from '../drops.js';
import { fovFor, BASE_FOV } from '../camera.js';
import { characterPose } from '../character.js';

export const SKY = 0xbfe0f4;
const RAIN_SKY = 0x8a9aa8; // 下雨時天空變暗
const MAX_RAIN = 1500;
const MAX_SPLASH = 400;

function pixelTexture(url) {
  const tex = new THREE.TextureLoader().load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 方塊小人（素材包沒有人物圖，用純色方塊）。高 1.8 格，面向 -z；手、腳、頭各有自己的關節
const LIMB = 0.68, HEAD = 0.44, SLEEVE = LIMB - 0.18; // 袖子下面接手，不重疊（重疊會閃）
function box(w, h, d, color, y = 0, x = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}
function joint(x, y, z, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(...children);
  return g;
}
function buildCharacter(shirt = 0x3a8fb7) {
  const skin = 0xe0b48a, pants = 0x3b4a8a, hair = 0x4a2f1d, eye = 0x1d1d1d;
  const root = new THREE.Group();
  const parts = {
    leftLeg: joint(-0.11, LIMB, 0, box(0.22, LIMB, 0.22, pants, -LIMB / 2)),
    rightLeg: joint(0.11, LIMB, 0, box(0.22, LIMB, 0.22, pants, -LIMB / 2)),
    leftArm: joint(-0.32, LIMB * 2 - 0.04, 0, box(0.2, SLEEVE, 0.2, shirt, -SLEEVE / 2 + 0.04), box(0.2, 0.18, 0.2, skin, -LIMB + 0.13)),
    rightArm: joint(0.32, LIMB * 2 - 0.04, 0, box(0.2, SLEEVE, 0.2, shirt, -SLEEVE / 2 + 0.04), box(0.2, 0.18, 0.2, skin, -LIMB + 0.13)),
    head: joint(0, LIMB * 2, 0,
      box(HEAD, HEAD, HEAD, skin, HEAD / 2),
      box(HEAD + 0.02, 0.1, HEAD + 0.02, hair, HEAD - 0.04),
      box(HEAD + 0.02, 0.2, 0.06, hair, HEAD - 0.1, 0, HEAD / 2 - 0.02),
      box(0.07, 0.07, 0.02, eye, HEAD * 0.55, -0.1, -HEAD / 2 - 0.005),
      box(0.07, 0.07, 0.02, eye, HEAD * 0.55, 0.1, -HEAD / 2 - 0.005)),
  };
  root.add(box(0.44, LIMB, 0.22, shirt, LIMB * 1.5), ...Object.values(parts));
  return { root, parts };
}

// 別人的衣服顏色（依編號輪流），才分得出誰是誰
const SHIRTS = [0xc0392b, 0x27ae60, 0x8e44ad, 0xd35400, 0x16a085, 0xd4ac0d, 0x2c3e50, 0xe84393];

// 頭上的名字：畫在 canvas 上當貼圖（不是 HTML，別人給的文字不會變成程式）
function nameTag(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px system-ui, "Microsoft JhengHei", sans-serif';
  const w = Math.min(248, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(0, 0, 0, 0.45)';
  g.fillRect((256 - w) / 2, 8, w, 48);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 128, 33, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.2;
  return sprite;
}

function posePlayer(character, p) {
  const { root, parts } = character;
  const pose = characterPose(p);
  root.position.set(p.pos.x, p.pos.y, p.pos.z);
  root.rotation.y = pose.body;
  parts.head.rotation.x = pose.head;
  for (const k of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']) parts[k].rotation.x = pose[k];
}

function toGeometry(mesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
  // 明暗是 0–1 的 sRGB 值，three.js 的頂點顏色是線性的，所以先換算
  g.setAttribute('color', new THREE.BufferAttribute(mesh.colors.map((v) => v ** 2.2), 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeBoundingSphere();
  return g;
}

export class View {
  constructor(canvas, game) {
    this.game = game;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1); // 舊電腦：不畫高解析度
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 40, 90);
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 120);
    this.camera.rotation.order = 'YXZ';

    this.atlas = pixelTexture('assets/atlas.png');
    this.blockMaterial = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true });

    this.worldMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.blockMaterial);
    this.scene.add(this.worldMesh);
    this.worldVersion = -1;

    // 準星指著的方塊：黑色外框
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // 挖方塊的裂痕：比方塊大一點點的透明方塊，cracks.png 10 張排成一排，換 offset 就換張
    this.cracks = pixelTexture('assets/cracks.png');
    this.cracks.repeat.set(1 / CRACK_STAGES, 1);
    this.crackBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({ map: this.cracks, transparent: true, depthWrite: false }),
    );
    this.crackBox.visible = false;
    this.scene.add(this.crackBox);

    // 自己的方塊小人：第三人稱才看得到
    this.character = buildCharacter();
    this.character.root.visible = false;
    this.scene.add(this.character.root);
    this.remote = new Map(); // 多人連線：別人的小人
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    // 掉落物：每種方塊一份小方塊的形狀，每個掉落物一個 mesh
    this.dropGeometries = new Map();
    this.dropMeshes = new Map();

    // 雨滴和水花：各用一個 InstancedMesh，一次畫完（舊電腦也順）
    const rainMat = new THREE.MeshBasicMaterial({ color: 0x5f8fd8, transparent: true, opacity: 0.6, depthWrite: false });
    this.rainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), rainMat, MAX_RAIN);
    this.splashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), rainMat, MAX_SPLASH);
    for (const m of [this.rainMesh, this.splashMesh]) {
      m.count = 0;
      m.frustumCulled = false;
      this.scene.add(m);
    }
    this.dummy = new THREE.Object3D();
    this.skyNow = new THREE.Color(SKY);
    this.skyClear = new THREE.Color(SKY);
    this.skyRain = new THREE.Color(RAIN_SKY);

    this.addClouds();
    this.resize();
  }

  addClouds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    const spots = [[-22, 31, -12, 12, 6], [54, 28, 8, 10, 5], [12, 35, 58, 14, 7], [38, 26, -24, 8, 4], [-20, 25, 46, 9, 5]];
    for (const [x, y, z, w, d] of spots) {
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), mat);
      cloud.position.set(x, y, z);
      this.scene.add(cloud);
    }
  }

  syncCharacter() {
    this.character.root.visible = this.game.showCharacter();
    if (this.character.root.visible) posePlayer(this.character, this.game.player);
  }

  // 多人連線：別人的小人和名字
  syncOthers() {
    const others = this.game.others;
    for (const [id, ch] of this.remote) {
      if (others.has(id)) continue;
      this.scene.remove(ch.root);
      ch.tag.material.map.dispose();
      this.remote.delete(id);
    }
    for (const [id, o] of others) {
      let ch = this.remote.get(id);
      if (!ch) {
        ch = buildCharacter(SHIRTS[id % SHIRTS.length]);
        ch.tag = nameTag(o.name);
        ch.root.add(ch.tag);
        this.scene.add(ch.root);
        this.remote.set(id, ch);
      }
      posePlayer(ch, o);
    }
  }

  syncDrops() {
    const alive = new Set(this.game.drops);
    for (const [drop, mesh] of this.dropMeshes) {
      if (alive.has(drop)) continue;
      this.scene.remove(mesh);
      this.dropMeshes.delete(drop);
    }
    for (const drop of this.game.drops) {
      let mesh = this.dropMeshes.get(drop);
      if (!mesh) {
        if (!this.dropGeometries.has(drop.id)) this.dropGeometries.set(drop.id, toGeometry(blockMesh(drop.id, DROP_SIZE)));
        mesh = new THREE.Mesh(this.dropGeometries.get(drop.id), this.blockMaterial);
        this.dropMeshes.set(drop, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(drop.pos.x, drop.pos.y, drop.pos.z);
      mesh.rotation.y = drop.spin;
    }
  }

  syncRain(dt) {
    const rain = this.game.rain;
    const put = (mesh, list, max) => {
      const n = Math.min(list.length, max);
      for (let i = 0; i < n; i++) {
        const d = list[i];
        this.dummy.position.set(d.x, d.y + (mesh === this.rainMesh ? 0.25 : 0.02), d.z);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    };
    put(this.rainMesh, rain.drops, MAX_RAIN);
    put(this.splashMesh, rain.splashes, MAX_SPLASH);
    // 天空慢慢變暗／變亮
    this.skyNow.lerp(rain.active ? this.skyRain : this.skyClear, Math.min(1, dt * 2));
    this.scene.background.copy(this.skyNow);
    this.scene.fog.color.copy(this.skyNow);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  syncWorld() {
    const world = this.game.world;
    if (world.version === this.worldVersion) return;
    this.worldVersion = world.version;
    this.worldMesh.geometry.dispose();
    this.worldMesh.geometry = toGeometry(buildMesh(world));
  }

  render(dt = 1 / 60) {
    const { game, camera } = this;
    const p = game.player;
    const cam = game.camera();
    camera.position.set(cam.x, cam.y, cam.z);
    camera.rotation.set(cam.pitch, cam.yaw, 0);
    this.syncCharacter();
    this.syncOthers();
    // 衝刺時視角慢慢變寬，放開慢慢變回來
    const fov = fovFor(p);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 10);
      camera.updateProjectionMatrix();
    }

    this.syncWorld();
    this.syncDrops();
    this.syncRain(dt);

    const t = game.target();
    this.highlight.visible = !!t;
    if (t) this.highlight.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);

    const crack = game.crack();
    this.crackBox.visible = !!crack;
    if (crack) {
      this.crackBox.position.set(crack.x + 0.5, crack.y + 0.5, crack.z + 0.5);
      this.cracks.offset.x = crack.stage / CRACK_STAGES;
    }

    this.renderer.render(this.scene, camera);
  }
}
