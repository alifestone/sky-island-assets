# 空中之島（Week 7 作業）

一座浮在天空中的方塊小島：走路、挖方塊、撿起來、放回去，還會下雨；可以合成、衝刺、換第三人稱看自己的小人。
three.js 靜態網站，不用伺服器、不用帳號、不用遊戲引擎。

## 怎麼玩

```bash
npm start          # 開本機網頁 → http://localhost:8080
npm test           # 一行跑全部測試（Node 內建 node --test，不用裝套件）
```

ES module 不能用 `file://` 直接開，所以要用 `npm start`（或任何靜態伺服器、GitHub Pages）。

| 操作 | 按鍵 |
|---|---|
| 走路／跳 | `W` `A` `S` `D`／空白鍵 |
| 轉視角 | 滑鼠 |
| 挖方塊 | 按住左鍵 |
| 撿起來 | 走到掉落物旁邊 |
| 放方塊 | 右鍵 |
| 衝刺 | 按住 `Shift` + `W` |
| 選方塊欄 | `1`–`9`、滾輪 |
| 合成 | `E`，或對著合成台按右鍵 |
| 換視角（第一人稱／背後／前面） | `V` |
| 下雨／停雨 | `R` |
| 暫停 | `Esc` |

## 文件

| 檔案 | 回答的問題 | 誰寫 |
|---|---|---|
| [BRIEF.md](BRIEF.md) | 做什麼（目的、限制） | 我 |
| [VERIFY.md](VERIFY.md) | 怎樣算做好（第 1 批老師的測試、第 2 批我的測試） | 我 |
| [PLANS.v1.md](PLANS.v1.md) | AI 起草的第一版計畫（對照用） | AI |
| [PLANS.md](PLANS.md) | 審查後的計畫、邊做邊調整的紀錄 | AI 起草，我審 |
| [AGENTS.md](AGENTS.md) | AI 怎麼做事 | 我 |

## 程式

```
src/            遊戲邏輯（不碰 three.js，所以可以在 Node 裡測）
src/render/     mesher.js：世界 → 頂點；view.js：three.js 畫面
src/main.js     鍵盤滑鼠 → Game → 畫面
tests/          一個步驟一個測試檔，對到 VERIFY.md 的 STEP
assets/         課程素材包（原封不動）
```

每一步的 git 紀錄都是「測試（紅）」→「全部通過」兩個 commit。

## 授權

- 程式：MIT（見 [LICENSE](LICENSE)）
- `assets/` 素材：© 2026 JUNHAO CHEN，[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)（見 [assets/README.txt](assets/README.txt)）
