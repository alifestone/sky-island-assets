// three.js 畫面：只負責把 Game 的狀態畫出來，不改遊戲規則
import * as THREE from 'three';
import { buildMesh, blockMesh } from './mesher.js';
import { eyePosition } from '../physics.js';
import { CRACK_STAGES } from '../mining.js';
import { DROP_SIZE } from '../drops.js';
import { fovFor, BASE_FOV } from '../camera.js';

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
    const eye = eyePosition(p);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(p.pitch, p.yaw, 0);
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
