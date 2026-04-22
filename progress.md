# Progress

## 2026-04-23（更新：title_ef_0099）

### 當前預覽用素材（title_ef_0099）
- **LMB → JSON:** `bun lmbtojson.ts` 已對 `E:/XB/解包/.../title_ef_0099/title_ef_0099.lm` 轉出同目錄 `title_ef_0099.json`；副本：`preview/public/title_ef_0099.json`（約 974KB）。
- **NUTEXB → PNG:** 使用 `E:/research/ultimate_tex/target/release/ultimate_tex_cli.exe` 批次轉 20 個 `img-0000x.nutexb` → `preview/public/textures/`，檔名對齊 JSON 內 `textureAtlases[].name`（`Mask.png`, `bg.png`, `circle03.png`, …, `z_left.png`）。
- **舞台:** `meta` 324×64，60fps，**`timeline.rootSpriteId` = 58**（在預覽中選根 sprite 時留意此 ID）。
- **Sprites 數量:** 轉換統計 18 個 sprite 定義、20 個 atlas。

在瀏覽器打開 `http://localhost:5173/`（Vite 已運行則同埠），**Open JSON** 選 `preview/public/title_ef_0099.json`（或從倉庫外路徑選同一文件），紋理應從 `/textures/<atlas name>` 全部 200。

---

## 2026-04-23 Session（先前記錄）

### 環境狀態
- Dev server: localhost:5173 (已運行)
- 測試文件: `preview/public/title_ef_0060.json`（仍保留）；當前主推 **title_ef_0099** 見上節
- title_ef_0085.json: 已轉換至 E:/XB/解包/vs2/bak/009gui/flash/shogo/effect/title_ef_0085/

### 分析發現

#### LMB 結構 (title_ef_0060)
- Root sprite 20: 1 frame，displayList: char=1(button), char=19(sprite)
- Sprite 19: 150 frames，嵌套 sprite 10, 13
- 所有葉節點都是 button 類型（含 graphic vertices）
- graphics 定義為空，graphic 資料在 button.graphics[] 內
- 7 個 texture atlas，全部載入成功

#### WebGL 渲染問題
- Canvas 有渲染（88% 像素覆蓋），但圖形集中在右下角 (310,57)-(323,63)
- 攔截 uniformMatrix3fv 發現 world transform x=263, y=76（超出 canvas 64px 高度）
- transform 座標範圍：x: -258..218, y: -78..64（以某點為原點）
- 根本原因未確定：可能是 multiplyTransforms 累積誤差，或座標系原點假設錯誤

#### nutexb 命名
- Atlas 有 name 字段（如 "Mask.png", "84_watch_180316.PNG"）
- 目前 loadAtlasTextures 用 img-00000.png 索引命名
- 需要改為用 atlas.name 命名

#### Open JSON 按鈕
- 有時 file chooser modal 殘留，導致後續操作被阻擋
- 根本原因未調查
