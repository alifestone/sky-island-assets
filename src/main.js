// 讀鍵盤和滑鼠 → Game.update() → View.render()，每一格做一次
import { Game } from './game.js';
import { View } from './render/view.js';

const canvas = document.getElementById('game');
const startScreen = document.getElementById('start');
const fpsLabel = document.getElementById('fps');

const game = new Game();
const view = new View(canvas, game);
window.game = game; // 方便在主控台檢查

const keys = new Set();
const mouse = { left: false, rightPressed: false };
let toggleRain = false;
let select = null;
let playing = false;

function lock() {
  canvas.requestPointerLock?.();
}

document.getElementById('play').addEventListener('click', lock);
canvas.addEventListener('click', () => { if (!playing) lock(); });

document.addEventListener('pointerlockchange', () => {
  playing = document.pointerLockElement === canvas;
  startScreen.classList.toggle('hidden', playing);
  if (!playing) { keys.clear(); mouse.left = false; }
});

document.addEventListener('mousemove', (e) => {
  if (playing) game.look(e.movementX * 0.0025, e.movementY * 0.0025);
});

canvas.addEventListener('mousedown', (e) => {
  if (!playing) return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.rightPressed = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('wheel', (e) => {
  if (!playing) return;
  select = { delta: Math.sign(e.deltaY) };
});

document.addEventListener('keydown', (e) => {
  if (!playing) return;
  if (e.code === 'KeyR' && !e.repeat) toggleRain = true;
  if (/^Digit[1-8]$/.test(e.code)) select = { index: Number(e.code.slice(5)) - 1 };
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('resize', () => view.resize());

function readInput() {
  const input = {
    forward: keys.has('KeyW') || keys.has('ArrowUp'),
    back: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    jump: keys.has('Space'),
    mine: mouse.left,
    place: mouse.rightPressed,
    toggleRain,
    select,
  };
  mouse.rightPressed = false;
  toggleRain = false;
  select = null;
  return input;
}

let last = performance.now();
let frames = 0, fpsTime = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (playing) game.update(dt, readInput());
  view.render();

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsLabel.textContent = `${Math.round(frames / fpsTime)} fps`;
    frames = 0; fpsTime = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
