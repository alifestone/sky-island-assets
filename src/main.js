// 讀鍵盤和滑鼠 → Game.update() → View.render()，每一格做一次
import { Game } from './game.js';
import { View } from './render/view.js';
import { BLOCKS, iconName, CRAFTING_TABLE } from './blocks.js';
import { NetClient, serverUrl } from './net.js';

const canvas = document.getElementById('game');
const startScreen = document.getElementById('start');
const fpsLabel = document.getElementById('fps');
const hotbar = document.getElementById('hotbar');
const statusLabel = document.getElementById('status');
const craftingPanel = document.getElementById('crafting');
const recipesEl = document.getElementById('recipes');
const tableHint = document.getElementById('table-hint');
const netLabel = document.getElementById('net');
const nameInput = document.getElementById('name');

const game = new Game();
const view = new View(canvas, game);
window.game = game; // 方便在主控台檢查
window.view = view;

// 多人連線：第一次按開始才連線（才知道名字）；名字記在這台電腦（存不了也沒關係）
let net = null;
try { nameInput.value = localStorage.getItem('sky-island-name') ?? ''; } catch {}
function connect() {
  if (net) return;
  const url = serverUrl(location);
  const name = nameInput.value.trim();
  try { localStorage.setItem('sky-island-name', name); } catch {}
  if (url) net = window.net = new NetClient(game, { url, name });
  else netLabel.textContent = '單人';
}
nameInput.addEventListener('keydown', (e) => e.stopPropagation()); // 打名字時不要觸發遊戲按鍵

const icon = (id) => `assets/icons/${iconName(id)}.png`;

// 方塊欄：圖示 + 數字，選中的那格有框；有變才更新
const slotEls = game.inventory.slots.map((slot, i) => {
  const el = document.createElement('div');
  el.className = 'slot';
  const badge = slot.id === CRAFTING_TABLE ? '<span class="badge">合成台</span>' : '';
  el.innerHTML = `<img src="${icon(slot.id)}" alt="${BLOCKS[slot.id].label}">${badge}<span class="count"></span>`;
  el.title = `${i + 1} ${BLOCKS[slot.id].label}`;
  hotbar.appendChild(el);
  return el;
});
let hotbarKey = '';
function updateHotbar() {
  const inv = game.inventory;
  const key = inv.selected + ':' + inv.slots.map((s) => s.count).join(',');
  if (key === hotbarKey) return;
  hotbarKey = key;
  inv.slots.forEach((slot, i) => {
    const el = slotEls[i];
    el.classList.toggle('selected', i === inv.selected);
    el.classList.toggle('empty', slot.count === 0);
    el.querySelector('.count').textContent = slot.count > 0 ? slot.count : '';
  });
}

// 合成畫面：每個配方一列（只建一次）；材料、是否靠近合成台有變才更新文字和按鈕
const label = (id) => BLOCKS[id].label;
const recipeRows = game.recipeList().map((r) => {
  const row = document.createElement('div');
  row.className = 'recipe';
  const tag = r.needsTable ? '<span class="tag">要合成台</span>' : '';
  row.innerHTML = `<img src="${icon(r.output.id)}" alt="">
    <div class="what"><b>${r.name} ×${r.output.count}</b>${tag}<div class="need"></div></div>
    <button>合成</button>`;
  row.querySelector('button').addEventListener('click', () => game.craft(r.id));
  recipesEl.appendChild(row);
  return { need: row.querySelector('.need'), button: row.querySelector('button') };
});
let recipesKey = '';
function updateRecipes() {
  const list = game.recipeList();
  const key = game.nearTable() + ':' + list.map((r) => r.reason).join(',') + ':' + hotbarKey;
  if (key === recipesKey) return;
  recipesKey = key;
  tableHint.textContent = game.nearTable() ? '旁邊有合成台：所有配方都能用。' : '標「要合成台」的配方，要站在合成台旁邊（3 格內）。';
  list.forEach((r, i) => {
    const { need, button } = recipeRows[i];
    need.textContent = r.inputs.map(([id, n]) => `${label(id)} ×${n}（有 ${game.inventory.count(id)}）`).join(' + ');
    button.disabled = !r.canCraft;
    button.title = r.reason ?? '';
  });
}

const keys = new Set();
const mouse = { left: false, rightPressed: false };
let toggleRain = false;
let toggleCraft = false;
let toggleView = false;
let select = null;
let playing = false; // 遊戲在跑（包含開著合成畫面的時候）
let noLock = false; // 瀏覽器不給鎖滑鼠
let panelShown = false;

function lock() {
  if (!noLock) canvas.requestPointerLock?.();
}

function setPlaying(on) {
  playing = on;
  startScreen.classList.toggle('hidden', playing);
  if (!playing) { keys.clear(); mouse.left = false; }
}

document.getElementById('play').addEventListener('click', () => {
  connect();
  if (noLock) setPlaying(true);
  else lock();
});
canvas.addEventListener('click', () => { if (!playing) { connect(); lock(); } });
document.getElementById('close-crafting').addEventListener('click', () => { toggleCraft = true; });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) setPlaying(true);
  else if (!game.craftingOpen) setPlaying(false); // 開合成畫面時放開滑鼠，不是暫停
});
// 有些瀏覽器（或內嵌頁面）不給鎖滑鼠：照樣開始玩，移動滑鼠一樣能轉視角，Esc 暫停
document.addEventListener('pointerlockerror', () => { noLock = true; setPlaying(true); });

document.addEventListener('mousemove', (e) => {
  if (playing && !game.craftingOpen) game.look(e.movementX * 0.0025, e.movementY * 0.0025);
});

canvas.addEventListener('mousedown', (e) => {
  if (!playing || game.craftingOpen) return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.rightPressed = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('wheel', (e) => {
  if (!playing || game.craftingOpen) return;
  select = { delta: Math.sign(e.deltaY) };
});

document.addEventListener('keydown', (e) => {
  if (!playing) return;
  if (e.code === 'Escape') {
    if (game.craftingOpen) toggleCraft = true; // Esc 關掉合成畫面
    else if (!document.pointerLockElement) setPlaying(false);
    return;
  }
  if (e.repeat) return keys.add(e.code);
  if (e.code === 'KeyE') toggleCraft = true;
  if (e.code === 'KeyR') toggleRain = true;
  if (e.code === 'KeyV') toggleView = true;
  if (/^Digit[1-9]$/.test(e.code)) select = { index: Number(e.code.slice(5)) - 1 };
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
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    mine: mouse.left,
    place: mouse.rightPressed,
    toggleRain,
    toggleCraft,
    toggleView,
    select,
  };
  mouse.rightPressed = false;
  toggleRain = false;
  toggleCraft = false;
  toggleView = false;
  select = null;
  return input;
}

// 合成畫面開／關：開的時候放開滑鼠讓人點按鈕，關的時候再鎖回去
function syncPanel() {
  if (game.craftingOpen === panelShown) return;
  panelShown = game.craftingOpen;
  craftingPanel.classList.toggle('hidden', !panelShown);
  if (panelShown) {
    keys.clear();
    mouse.left = false;
    recipesKey = '';
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    lock();
  }
}

let last = performance.now();
let frames = 0, fpsTime = 0;
let lastStatus = '';

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (playing) game.update(dt, readInput());
  if (net) {
    net.update(dt);
    const text = net.statusText();
    if (netLabel.textContent !== text) netLabel.textContent = text;
  }
  syncPanel();
  view.render(dt);
  document.body.classList.toggle('third-person', game.viewMode !== 'first');
  updateHotbar();
  if (panelShown) updateRecipes();
  const status = game.status();
  if (status !== lastStatus) {
    lastStatus = status;
    statusLabel.textContent = status ? `☔ ${status}` : '';
    statusLabel.classList.toggle('show', !!status);
  }

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsLabel.textContent = `${Math.round(frames / fpsTime)} fps`;
    frames = 0; fpsTime = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
