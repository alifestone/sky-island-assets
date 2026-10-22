// 步驟 0 測試環境：npm test 一行跑全部；npm start 開本機靜態網頁
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { contentType } from '../scripts/serve.js';

test('npm test 跑得起來', () => {
  assert.ok(true);
});

test('本機伺服器給對檔案類型', () => {
  assert.equal(contentType('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentType('src/main.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentType('assets/atlas.png'), 'image/png');
});

test('入口和素材都在', () => {
  assert.ok(existsSync('index.html'));
  assert.ok(existsSync('assets/atlas.png'));
  assert.ok(existsSync('assets/cracks.png'));
});
