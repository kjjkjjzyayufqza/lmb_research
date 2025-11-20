## Preview Tool Design

本文件定義 LMB→JSON 預覽工具的**最終開發目標**與技術方案。  
目標是：在給定 `.lmb` 檔的前提下，透過 `lmbtojson.ts` 產生的 JSON，**在瀏覽器中 100% 重現原生遊戲中顯示的 UI 與時間軸動畫效果（可視結果完全一致）**。

---

## 總體目標與驗收標準

- **總體目標**
  - 基於 `LMBtoJSON.md` 的 JSON 結構，實作一個 HTML + JavaScript 的預覽 runtime。
  - 在引擎行為等同的前提下，對任意合法 LMB 檔，預覽結果在畫面上與原引擎**像素級一致或極接近**。

- **驗收標準（至少包含）：**
  - **幾何與貼圖**
    - 所有 `graphics` 及其 `vertices` / `indices` 正確繪製。
    - `textureAtlases` 與實際外部貼圖尺寸匹配，UV 對應正確，無拉伸或偏移。
  - **變換與座標**
    - 對 `transforms`（a,b,c,d,x,y）與 `positions` 應用後，所有物件位置、縮放、旋轉與 skew 與原版一致。
    - depth / z-order 正確，前後關係與原版完全相同。
  - **顏色與混合**
    - 支援 `color_mult_id` / `color_add_id` 所代表的顏色乘法與加法，效果與原版眼觀一致。
    - 完整支援 `BlendMode`（NORMAL, LAYER, MULTIPLY, SCREEN, ADD, SUBTRACT, OVERLAY 等），對應到 WebGL blend state，渲染效果接近原引擎。
    - `COLOR_MATRIX`（若存在）能透過 shader / filter 正確運算。
  - **時間軸與動畫**
    - 根據 `framerate` 及 `SpriteDef.timeline`，逐 frame 播放時序正確。
    - `FRAME_LABEL` 完整支援，`gotoAndPlay(label)` / `gotoAndStop(label)` 能準確跳轉。
    - `KEYFRAME` / `SHOW_FRAME` 對 display list 的更新行為完全一致（place / move / remove）。
  - **互動與 UI**
    - `buttons` + `bounds` 定義的按鈕熱區與原版一致，鼠標 / 觸控事件位置完全對齊。
    - `dynamic_text` 文字內容、對齊與大小與原版一致（字體渲染形狀可容許細微差異）。
  - **腳本 / 行為（至少部分）**
    - `do_action` / `action_script` 對應的關鍵行為（例如簡單 goto, play, stop, flag 切換）能在預覽中被正確模擬，使畫面流程與原版一致。

以上條件作為後續所有設計與實作決策的前提：**任何簡化在最終版本都必須被補完，直至達到上述可視與行為上的等價性。**

---

## 技術方案選擇

- **最終方案：React + Vite + WebGL 渲染**

說明：

- 使用 **React** 构建 UI（控制面板、档案载入、除錯 UI），利用其状态管理能力简化互动逻辑。
- 使用 **Vite** 作为构建工具，提供快速的开发体验与现代化的打包流程。
- **使用 WebGL 作為唯一正式的渲染後端**，保證：
  - 完整控制混合模式、color multiply/add、color matrix 等效果。
  - 可用頂點緩衝區與索引緩衝區直接對應 `graphics.vertices/indices`。
  - 可準確實現 2D 變換矩陣與座標系。

---

## 整體架構

- **輸入**：
  - `.lmb` → 透過 `bun lmbtojson.ts <input.lmb>` 生成對應 `<input>.json`。
  - 或直接載入 JSON（例如 `CMN_ALLNET_ICON00.json`、`attract_extreme.json`）。
- **核心資料模型**：
  - 嚴格遵守 `LMBtoJSON.md` 中的結構：
    - `meta`
    - `resources`（symbols / colors / transforms / positions / bounds / textureAtlases）
    - `definitions`（sprites / texts / buttons / graphics / unknowns）
    - `timeline`（rootSpriteId）
- **輸出**：
  - WebGL 畫布中繪製的畫面，在幾何、顏色、動畫節奏與互動行為上與原遊戲中的 LMB 顯示結果一致。

資料流程：

1. 使用者在工具中選擇 JSON 檔（或先選 LMB 再由後端/本地指令轉為 JSON）。
2. 前端載入 JSON，構建內部 runtime 結構與資源表。
3. 初始化 WebGL：載入貼圖、建立 shader 程式與頂點格式。
4. 建立 `TimelinePlayer`，從 `rootSpriteId` 對應的 sprite 開始播放。
5. 使用 requestAnimationFrame 逐幀更新場景並重繪，直到達到原動畫的完整播放行為。

---

## JSON 結構對 Runtime 的完整映射

### `meta`

- `framerate` → 控制時間軸前進速度，每秒 frame 數必須與原版一致。
- `width` / `height` → 定義舞台座標系與 WebGL 視口大小。
- 其他欄位（resourceId 等）可以用於資訊顯示與 debug，不影響渲染。

### `resources`

- `symbols`：
  - 形成字串資源表（symbol name、texture atlas 名稱、frame labels 等）。
  - runtime 提供 `getSymbolString(id: number): string`。
- `colors`：
  - 作為 color multiply/add 的輸入，需轉為線性/非線性顏色空間（依實機推測）後在 shader 中使用。
  - runtime 提供 `getColor(id: number)`，回傳 RGBA 值。
- `transforms` / `positions`：
  - 統一轉換為 3x3 或 4x4 矩陣，用於 WebGL 頂點變換。
  - 根據 `position_flags` 決定從哪一個表取值：
    - `TRANSFORM`：使用 `transforms[id]`。
    - `POSITION`：使用 `positions[id]` 組合成平移矩陣。
    - `NO_TRANSFORM`：使用單位矩陣。
- `bounds`：
  - 作為 hit test 區域與除錯 overlay 的基礎。
- `textureAtlases`：
  - 每個 atlas 對應一張實際載入的貼圖（例如 `cmn_allnet_icon00.tga`）。
  - 預覽工具中需提供貼圖路徑配置（例如通過固定規則或設定檔）。

### `definitions`

- `sprites`（核心）：
  - 每個 sprite 定義一組 frame 序列，內含 display list 操作。
  - runtime 中對應 `SpriteDefinition` 類型，包含：
    - `characterId`、`name`、`boundsId`。
    - `timeline: Frame[]`。
    - `frameLabels: { [label: string]: frameIndex }`。
- `graphics`：
  - 描述 mesh 幾何與 UV 資訊。
  - runtime 需將其轉為 WebGL buffer：
    - 頂點緩衝：`[x, y, u, v]`。
    - 索引緩衝：`indices`。
  - `atlasId` 决定從哪張貼圖取樣。
- `buttons`：
  - 對應按鈕（可能內部引用多個 `graphic` tag）。
  - 確定 hover / click 區域、關聯動畫 sprite（若有）。
- `texts`：
  - 對應 `dynamic_text`，包含文字內容 ID、stroke 顏色、alignment、size 等。
  - 預覽中使用 HTML/Canvas 字型渲染，保證位置與粗略樣式一致。

### 時間軸與場景

- `timeline.rootSpriteId`：
  - 作為入口 sprite，預覽頁首次載入時應自動播放此 sprite。
- `SpriteDef.timeline`：
  - 每個 frame 包含以下資訊：
    - `displayList: PlaceObjectAction[]`：新增或更新物件。
    - `removeList: RemoveObjectAction[]`：移除指定 depth 的物件。
    - `actions: DoAction[]`：執行腳本指令（例如 goto）。

runtime 中透過 `Scene` 對應一個「當前 frame 的 display list 狀態」，frame 變動時更新 Scene，然後 Scene 為渲染層提供當前 frame 需要繪製的一組 instance。  

---

## WebGL 渲染設計（強制要求）

- **座標系與矩陣**
  - 統一採用與 LMB 相同的 2D 座標系（左上角 / 中心點視實測而定，但在工具中固定下一種並透過對比原畫面校準）。
  - 所有 `transforms` / `positions` 最終轉為頂點 shader 中使用的 model matrix。

- **貼圖與圖元**
  - 每個 `graphic` 生成一個可重用的 `Geometry` 資源：vertex buffer + index buffer。
  - 根據 `atlasId` 綁定對應的 texture atlas。
  - 支援多個 atlas 在同一 frame 同時存在。

- **顏色與混合**
  - shader input 包含：
    - `colorMult`（從 `color_mult_id` 取得）。
    - `colorAdd`（從 `color_add_id` 取得）。
  - 實作方式：
    - 在 fragment shader 中計算：  
      \[ outColor = textureColor * colorMult + colorAdd \]  
      並考慮正確的範圍與 gamma。
  - BlendMode 對應表（示意）：
    - NORMAL → `gl.blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`。
    - ADD → `gl.blendFunc(ONE, ONE)`。
    - MULTIPLY → `gl.blendFunc(DST_COLOR, ONE_MINUS_SRC_ALPHA)`。
    - SCREEN / OVERLAY 等根據實機效果調整，必要時使用 shader 內部邏輯模擬。

- **Color Matrix**
  - 若 tag 含有 `COLOR_MATRIX`，需在 shader 中增加 4x5 矩陣計算，套用到最終顏色。

---

## 腳本與動作處理

- 完成度要求：
  - 對於會影響可視結果的動作指令，必須在預覽工具中被等價處理。
  - 至少覆蓋：
    - 與時間軸控制相關的 goto/play/stop。
    - 控制 `visible` / `alpha` / `x` / `y` 等屬性的動作。

- 實作思路：
  - 基於 `do_action.actionId` 建立一層對照表，從 JSON 或外部描述檔中知道每個 id 的含義。
  - 在預覽 runtime 中實作一個小型「指令解譯器」，每一幀在處理 frame 時同步執行對應動作。

---

## 工具 UI 與開發功能

- **必備控制項**
  - 檔案載入區：選擇 JSON 檔，顯示當前載入之檔名與 meta 資訊。
  - 播放控制：
    - Play / Pause / Stop。
    - 單步前進 / 單步後退。
    - 當前 frameIndex / frameLabel 顯示。
  - Sprite 選擇：
    - 下拉列表列出所有 sprites（`characterId` + 解析後名稱）。
    - 允許從任意 sprite 作為 root 播放。

- **除錯輔助**
  - 顯示 bounds overlay（可開關）。
  - 顯示 instance 的 depth、placementId、characterId。
  - 顯示每幀執行的 actions 列表。
  - 簡單 log 視窗用於顯示事件（例如 button click、frame_label 觸發）。

---

## 開發階段規劃（以達成 100% 還原為終點）

> 下列所有階段最終都必須完成，前期允許 stub/簡化，但最終版本不得保留「僅 MVP」實作。

- **第 1 階段：基礎 WebGL 渲染 + 靜態畫面校準**
  - 實作 JSON 載入、資源表建立、WebGL 初始化。
  - 正確渲染單一 frame 的所有 `graphics`（含 atlas / UV / transform），對齊原遊戲截圖。

- **第 2 階段：完整時間軸與 display list 邏輯**
  - 實作 `TimelinePlayer` 與 per-frame place/move/remove 邏輯。
  - 能完整播放一段動畫（不含復雜腳本），與原遊戲錄影比對畫面與節奏。

- **第 3 階段：顏色、混合模式與 color matrix**
  - 完整實作 color multiply/add 與 BlendMode 對應。
  - 若檔案使用 color matrix，還原其視覺效果。

- **第 4 階段：文字與按鈕互動**
  - 渲染 `dynamic_text` 並放置在正確位置。
  - 按 `buttons` + `bounds` 定義處理滑鼠事件，觸發對應動畫或動作。

- **第 5 階段：腳本指令還原**
  - 對 `do_action` / `action_script` 中與畫面相關的指令建立對應，確保畫面流向與原遊戲一致。

---

## 與 LMB 工具鏈的關係

- `lmbtojson.ts`：
  - 作為 LMB→JSON 的唯一來源，保證結構與 Kaitai 結果一致。
  - 預覽工具**嚴格依賴**此 JSON 結構，不直接解析二進位 LMB。

- 預覽工具：
  - 僅讀取 JSON，不修改 JSON 結構設計。
  - 若未來實作 JSON→LMB，預覽工具可與編輯工具共享同一套 JSON 結構與 runtime。

---

## 檔案與目錄建議

- `preview/`
  - `index.html`：Vite entry point。
  - `package.json`：專案依賴與腳本。
  - `vite.config.ts`：Vite 設定。
  - `src/`
    - `main.tsx`：React entry。
    - `App.tsx`：主應用組件。
    - `components/`：UI 組件（如 `ControlPanel`, `LogView` 等）。
    - `lib/`
      - `preview_runtime.ts`：JSON 解析與 runtime 結構。
      - `preview_renderer_webgl.ts`：WebGL 渲染層。
    - `styles/`：CSS 樣式檔。

實際打包可採用任意前端建構工具，但不影響上述結構與最終目標。

## 當前實作進度與未完成項目說明（2025-11 狀態）

### 已完成的核心能力（概覽）

- **JSON 結構 → Runtime 映射（初版）**
  - 透過 `lmbtojson.ts`，已能根據 `lmb.ksy`：
    - 建立 `meta`（含 `width/height/framerate` 等）。
    - 建立 `resources`（`symbols/colors/transforms/positions/bounds/textureAtlases`）。
    - 建立 `definitions.sprites/texts/buttons/graphics`。
    - 將 `define_sprite` 旗下的 `keyframe/show_frame/place_object/remove_object/do_action/frame_label` 壓平成 `SpriteDef.timeline: FrameDef[]`。
- **基礎 Scene / Timeline 播放**
  - `Scene` 會依照每一幀的 `displayList/removeList` 更新 display list（以 depth 做 key），並支援巢狀 sprite。
  - `TimelinePlayer` 會依據 `meta.framerate` 以固定頻率推進 `frameIndex`，並呼叫 `Scene.applyFrame` → WebGL 重新繪製。
  - 已可看到靜態畫面與「線性時間軸播放」的效果。
- **WebGL 渲染（基礎版）**
  - 能依 `graphics.vertices/indices` 與 `textureAtlases` 正確畫出基本幾何與貼圖。
  - 支援 `color_mult_id / color_add_id` 的乘色與加色計算（shader 中 `texColor * colorMult + colorAdd`）。
- **基礎 Debug 能力**
  - 控制面板可看到當前 `FrameIndex / Label`。
  - 透過 Debug 輸入可跳到指定 `frameIndex`，或依 `displayList` 長度搜尋第一個符合條件的幀，用於檢查某些關鍵幀的畫面狀態。

### 關鍵落差：尚未完成、導致與實機差異的部分

- **時間軸控制與腳本行為尚未實作**
  - 目前 `TimelinePlayer` 僅做「按 `framerate` 均速遞增 `frameIndex`，至尾端後 modulo 循環」：
    - 未處理 `do_action` / `action_script` 之類腳本指令。
    - 未根據 `frame_label` / `gotoAndPlay(label)` / `gotoAndStop(label)` 等控制播放流。
  - 結果：原本在遊戲中「播一段後停住或跳轉到特定段落」的 UI，現在會被強制完整 loop，產生「不斷閃爍 / 中間過渡幀也被顯示」的現象（例如 `ex_p_001_001_c01.json`）。

- **Place/Move 行為與 display list 邏輯仍為簡化版**
  - `place_object.placement_mode`（`place` / `move`）目前僅被轉成字串欄位紀錄，runtime 尚未依此區分「建立新實例」與「移動/更新既有實例」的語義。
  - 巢狀 sprite 與 `remove_object` 的交互邏輯仍有簡化與潛在 bug，可能導致巢狀物件生命週期與原版不一致。

- **腳本指令語意未還原**
  - `do_action.actionId` 目前僅被存成數字，沒有任何解譯層：
    - 未對應 `goto frame`、`goto label`、`play`、`stop`、flag 切換等行為。
    - 未處理可能影響 `visible/alpha/x/y` 等屬性的指令。
  - `action_script` / `action_script_2` 的 bytecode 僅被 JSON 保留（或尚未導出），預覽端沒有做任何解析與執行。

- **顏色、混合模式與 Color Matrix 僅實作了最小子集**
  - BlendMode 目前僅使用固定的 `NORMAL` 對應（`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`），未針對 `MULTIPLY/SCREEN/ADD/SUBTRACT/OVERLAY/...` 做完整對應。
  - `color_matrix`（tag `0xf037`）尚未套用到 shader，相關欄位目前僅作為資料保留。

- **文字與按鈕互動尚未完成**
  - `dynamic_text` 的渲染邏輯尚未整合進 WebGL/Canvas，預覽中看不到實際文字內容與對齊排版。
  - `button` 的 hit test、hover/click 狀態與對應腳本（按鈕行為）尚未實作，無法互動模擬。

### 為達到 100% 模擬遊戲 UI 播放行為，需要的後續改動

- **在 LMB→JSON 轉換層（`lmbtojson.ts`）補充資訊**
  - **保留 / 暴露完整腳本資訊**
    - 確認 `action_script` / `action_script_2` 的 bytecode 已被導出到 JSON（若尚未，需比照 `lmb.ksy` 補齊），以便預覽端建立對照表與簡易解譯器。
    - 在 `DoAction` / `Frame` 中保持 `actionId` 與對應腳本區塊（若有）的關聯，方便預覽端查表。
  - **更精確的標籤與時間軸資料**
    - 確保 `frame_label` 的 `start_frame` 與 label 字串對應關係被準確投影到 `SpriteDef.frameLabels` 中。
    - 若有多段 timeline 或 entry point 變化，需在 JSON 中提供足夠的 meta 資訊（例如 root sprite、入口 frame 等）。

- **在 Runtime 時間軸層（`preview_runtime.ts`）引入「時間軸狀態機 + 指令解譯器」**
  - **時間軸狀態機**
    - 擴展 `TimelinePlayer`，將目前單純的「線性遞增 + loop」改為具備：
      - 狀態：`playing/paused/stopped`。
      - API：`gotoFrame(index)`、`gotoLabel(label)`、`play()`、`stop()`、`pause()`。
    - 支援從腳本或 UI 調用這些 API，以符合原始引擎「從腳本控制 timeline」的模式。
  - **DoAction / ActionScript 解譯器（最小 MVP）**
    - 建立 `actionId → 行為描述` 的對照表（可配置化，如 JSON 或程式碼內 mapping），至少涵蓋：
      - 時間軸控制：`goto frame`、`goto label`、`play`、`stop`。
      - 顯示控制：`set visible/alpha/x/y` 等（若有）。
    - 在 `TimelinePlayer.applyCurrentFrame` 或 `tick` 中：
      - 取得當前幀的 `actions`，依序執行對應行為，更新 `frameIndex` 或其他狀態。
      - 確保在同一幀內的多個行為以正確順序影響時間軸與場景。
    - 後續再將 `action_script` bytecode 映射到較高層語意，逐步擴大還原範圍。

- **強化 Scene / display list 行為**
  - **正確處理 `placement_mode` 與 `remove_object`**
    - 針對 `place` vs `move` 明確定義：
      - `place`: 新建或替換該 depth 的實例。
      - `move`: 基於既有實例更新其 transform/color 等屬性，保留其他狀態（特別是巢狀 sprite 的內部 frame 狀態）。
    - 修正 `remove_object` 對 `nestedSpriteInstances` 的清理邏輯，避免殘留或錯誤刪除。
  - **巢狀 sprite 時間推進**
    - 釐清實機中巢狀 sprite 的更新規則（是否總是隨父 sprite 前進、是否會被腳本單獨控制），並對 `Scene.advanceNestedSprites` 做相應調整。

- **在 WebGL 層補齊顏色與混合模式**
  - **BlendMode 對應表**
    - 根據 `lmb.ksy` 中的 `blend_mode` enum，建立完整的 WebGL blend state 對應：
      - NORMAL / LAYER / MULTIPLY / SCREEN / ADD / SUBTRACT / OVERLAY / HARD_LIGHT 等。
    - 必要時透過 shader 內部運算模擬某些複合模式。
  - **Color Matrix 支援**
    - 若 JSON 中存在 color matrix 定義，需在 shader 中加入 4x5 matrix 的計算，並於 instance 渲染時綁定該矩陣。

- **文字與按鈕互動的還原**
  - **Dynamic Text**
    - 在 runtime 中為 `texts` 建立對應的渲染物件（可先使用 Canvas 2D / DOM 文字進行對位渲染），確保位置、大小與對齊接近原版。
  - **Buttons**
    - 依 `buttons + bounds` 定義建立 hit test 區域。
    - 將滑鼠/觸控事件映射到對應按鈕，根據原始腳本觸發動畫或 `do_action` 行為。

- **Debug / 開發工具輔助**
  - 補充每幀的 `actions` / `actionId` 顯示，以及對應的解譯結果（例如「gotoAndStop('loop')」），方便比對與除錯。
  - 提供「只播放到某個 label 或 frame 然後停下」的測試模式，便於對照遊戲錄影進行畫面比對。

以上項目完成後，預覽工具才能在「幾何 / 顏色 / 混合」之外，於「時間軸控制與行為邏輯」層面接近原遊戲，達成對 LMB UI 播放行為的高還原度模擬。
