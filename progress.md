# Progress

## 2026-04-23 Session

### 環境狀態
- Dev server: localhost:5173 (已運行)
- 測試文件: preview/public/title_ef_0060.json (324x64, 60fps)
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
