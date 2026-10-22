// three.js 畫面：只負責把 Game 的狀態畫出來，不改遊戲規則
import * as THREE from 'three';
import { buildMesh } from './mesher.js';
import { eyePosition } from '../physics.js';

export const SKY = 0xbfe0f4;

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
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 120);
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

  render() {
    const { game, camera } = this;
    const p = game.player;
    const eye = eyePosition(p);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(p.pitch, p.yaw, 0);

    this.syncWorld();

    const t = game.target();
    this.highlight.visible = !!t;
    if (t) this.highlight.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);

    this.renderer.render(this.scene, camera);
  }
}
