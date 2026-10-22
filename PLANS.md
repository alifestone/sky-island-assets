# PLANS — 空中之島

> AI 起草，我審方向。第一版留在 PLANS.v1.md 對照。
> 每一步：先寫測試 → 跑一次確認失敗 → commit → 寫程式 → 全部通過 → commit → 在這裡勾掉。

## 步驟

- [x] **0 測試環境**：`npm test` 一行跑全部測試；`npm start` 開本機靜態網頁 → 全部
- [x] **1 小島和走路**：32³ 世界、產生小島、第一人稱走路、碰撞、掉下去回島上、畫面 → STEP 0
- [x] **2 挖方塊**：按住左鍵累積進度、裂痕 0–9、放開歸零、各方塊挖掘時間 → STEP 1
- [x] **3 掉出來**：挖掉後在原位彈出同種小方塊、重力、落在方塊上、慢慢轉 → STEP 2
- [x] **4 撿起來**：靠近（1.5 格內）飛向玩家、方塊欄 +1、滿 64 撿不起來 → STEP 3
- [ ] **5 放回去**：右鍵放在看著的那一面、數字 −1、0 不能放、不能放在自己身上 → STEP 4
- [ ] **6 下雨**：R 切換、雨滴落到方塊頂面消失、屋簷下不淋雨、「淋雨中」提示 → STEP 5

第 1 批 = 步驟 0–5，第 1 批做完自己從頭整串玩一遍，再做步驟 6。

## 檔案怎麼放

```
index.html            入口：畫布、準星、方塊欄、開始畫面
style.css             HUD 樣式
src/
  blocks.js           方塊種類、每一面用 atlas 的哪一格、挖掘時間
  world.js            World（32×32×32 固定大小）、generateIsland()
  physics.js          玩家 AABB 碰撞、重力、跳、掉出世界回到出生點
  raycast.js          從眼睛往前找方塊（DDA），回傳方塊與面
  mining.js           挖方塊進度、裂痕階段
  drops.js            掉落物：重力、落地、旋轉、撿起
  inventory.js        方塊欄：數量、上限 64、選中的格子
  placement.js        能不能放、放方塊
  rain.js             下雨：雨滴、擋雨、玩家有沒有淋到
  game.js             把上面組起來：Game.update(dt, input)，不碰 three.js
  render/mesher.js    世界 → 頂點陣列（只畫露在外面的面），不碰 three.js
  render/view.js      three.js：場景、材質、mesh、裂痕、掉落物、雨
  main.js             讀鍵盤滑鼠 → Game → view，每格畫一次
tests/                node --test 測試，一個 STEP 一個檔
scripts/serve.js      不用安裝的本機靜態伺服器（只給開發用）
assets/               素材包（原封不動）
```

## 做法

- **邏輯和畫面分開**：`src/` 底下除了 `render/view.js` 和 `main.js`，都不 import three.js，
  所以測試可以直接在 Node 裡跑；測試用「假輸入」呼叫 `Game.update()` 模擬玩家按鍵。
- **three.js**：從 jsDelivr 載入固定版本 `three@0.160.0`（importmap），不用打包工具。
- **30 fps**：整個世界只有一個 mesh，只畫露在外面的面；用 `MeshLambertMaterial`；
  `pixelRatio` 最多 1；方塊改變時才重建 mesh；雨滴用一個 `InstancedMesh`。
- **素材**：方塊用 `assets/atlas.png`，裂痕用 `assets/cracks.png`，方塊欄用 `assets/icons/`；
  材質一律 `NearestFilter`；天空 `#bfe0f4`。

## 審查紀錄（對照 PLANS.v1.md，問三件事）

1. **VERIFY 每一條都排進去了嗎？** v1 把「掉出來、撿起來」併成一步，STEP 3 的「滿 64 撿不起來」沒排到。
   → 拆成步驟 3、4。
2. **每一步都對到測試嗎？** v1 的「放回去」沒有對到 STEP 4。 → 步驟 5 對到 STEP 4。
3. **有沒有偷加 BRIEF 沒要的？** v1 有「存檔」，BRIEF 寫了不做存檔。 → 劃掉。

## 調整紀錄

（AI 邊做邊調整時寫在這裡，說明改了什麼。）
- 步驟 3：掉落物上下方向只看「中心底下」那一格（測試發現小方塊會卡在隔壁格邊緣、看起來像浮著），水平彈出速度調小。
- 步驟 4：小方塊飛向玩家改成「越飛越快」（從 2 格／秒開始加速），原本 9 格／秒一下就到，看不出有飛過來。
- 步驟 4：方塊欄畫面（圖示、數字、選中框，1–8 和滾輪選格子）放在這一步，才看得到「數字 +1」。
