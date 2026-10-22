# AGENTS.md — 給 AI 的長期規則

## 一定要遵守

1. 不要讀取或複製範例網站的原始碼。
2. VERIFY.md 不要改，那是我的。
3. PLANS.md 你可以自己調整，回報時說改了什麼，但不能做 BRIEF 沒要的。
4. 一次只做一步，做完停下來回報。
5. 每一步用 TDD：先把這一步的測試寫好、跑一次確認失敗、commit，再寫程式；
   全部測試通過才 commit，並在 PLANS.md 勾掉這一步。
6. 不要為了通過而修改測試。覺得測試錯了，先問我。

## 這個專案

- 跑全部測試：`npm test`（Node 內建 `node --test`，不裝套件）。
- 本機開遊戲：`npm start`，再打開 http://localhost:8080 。
- 遊戲邏輯放在 `src/`，不能 import three.js；只有 `src/render/view.js` 和 `src/main.js` 可以用 three.js。
- 限制寫在 BRIEF.md 最後：three.js 靜態網站、30 fps、32×32×32、只用素材包。
- commit 說明寫清楚做了什麼、測試結果怎樣，例如「STEP 1 挖方塊：測試（紅）」「STEP 1 挖方塊：全部通過」。
