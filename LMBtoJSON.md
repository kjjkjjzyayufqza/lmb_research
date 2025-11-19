### 目標與整體思路

本文件說明如何將 LMB 資料（由 `Lmb.js` 解析後的物件樹）轉換為結構化、可讀性高的 JSON，並以此 JSON 作為「HTML 預覽引擎」的資料來源。  
我們的目標不是機械地 mirror Kaitai 的 raw 樹狀結果，而是：

- 提供穩定、語義清晰的 JSON 結構，方便後續做 diff、視覺化與修改。
- 保留足夠資訊，使得未來有可能從 JSON 再組裝回合法的 LMB（二向轉換）。
- 儘量沿用 LMB 原本的 ID/表格設計（symbols/colors/transforms/positions 等），避免丟失關聯關係。
- 讓前端（HTML/Canvas/WebGL）可以直接基於 JSON 建立一個小型 runtime，用來預覽 UI / 動畫與簡單互動。

實作上可以參考 `kaitai_struct_visualizer` 的 raw 輸出作為「資料來源」，但最終 JSON 結構會再進行一層整理與語義化，配合 HTML 預覽的實際需要。

---

### 頂層 JSON 結構設計

建議的 LMB→JSON 頂層結構如下（示意）：

```json
{
  "meta": {
    "magic": "LMB",
    "textureId": 16,
    "resourceId": 268501504,
    "totalFileLen": 7204,
    "width": 512,
    "height": 256,
    "framerate": 30
  },
  "resources": {
    "symbols": [],
    "colors": [],
    "transforms": [],
    "positions": [],
    "bounds": [],
    "textureAtlases": []
  },
  "definitions": {
    "sprites": [],
    "texts": [],
    "buttons": [],
    "graphics": []
  },
  "timeline": {
    "rootSpriteId": null,
    "sprites": []
  }
}
```

說明：

- `meta`：來自 `lmb_type` header 與 `properties` tag，包含基礎資訊。
- `resources`：對應 LMB 中的各種「表格型」 tag，例如 `symbols`, `colors`, `transforms`, `positions`, `bounds`, `texture_atlases`。
- `definitions`：對應於 `defines` / `define_sprite` / `dynamic_text` / `button` / `graphic` 等，描述可重用的物件定義。
- `timeline`：描述動畫或 UI 的實際時間軸結構與場景樹，主要由 `define_sprite`, `frame`, `keyframe`, `place_object`, `remove_object`, `do_action`, `frame_label` 等組成。

---

### `meta` 欄位設計

`meta` 的來源與映射關係如下：

- `magic`: 固定為 `"LMB"`，可由 `lmb.lmb.magic` 轉換為字串後去除終止符。
- `textureId`: 來自 `texture_id`。
- `resourceId`: 來自 `resource_id`。
- `totalFileLen`: 來自 `total_file_len`。
- `width`, `height`, `framerate`: 來自 `properties` tag。
- 其他 `unknownX` 欄位（例如 `unknown4`, `unknown5` 等）可視情況加入 `meta.unknown` 子結構中，以免丟失資訊。

範例：

```json
{
  "meta": {
    "magic": "LMB",
    "textureId": 16,
    "resourceId": 268501504,
    "totalFileLen": 7204,
    "width": 512,
    "height": 256,
    "framerate": 30,
    "unknown": {
      "xmdPadding": "00000000",
      "numPadding": 2,
      "unknown4": 0,
      "unknown5": 0
    }
  }
}
```

---

### `resources`：基礎表格資料映射

#### Symbols

來源：`SYMBOLS` (`0xF001`) tag 中的 `Symbols` 結構。

建議 JSON 表示：

```json
{
  "resources": {
    "symbols": [
      { "id": 0, "value": "lmf" },
      { "id": 1, "value": "9" },
      { "id": 2, "value": "Notice_Mode_mc" },
      { "id": 3, "value": "Start" }
    ]
  }
}
```

映射規則：

- `id`：對應 `values` 陣列的索引。
- `value`：對應 Kaitai `String.value` 欄位。
- padding `Nothing` 不需要在 JSON 中顯式呈現。

#### Colors

來源：`COLORS` (`0xF002`) tag 的 `Colors` 結構。

建議 JSON 表示：

```json
{
  "resources": {
    "colors": [
      { "id": 0, "r": 256, "g": 256, "b": 256, "a": 256 },
      { "id": 1, "r": 0, "g": 0, "b": 0, "a": 0 }
    ]
  }
}
```

映射規則：

- `id`：為 `values` 的索引。
- `r, g, b, a`：直接使用 `u2` 整數值，是否需要歸一化到 0–1 或 0–255 可作為額外選項。

#### Transforms, Positions, Bounds

這三類結構皆為 `num_values` + 陣列形式，很適合映射為 ID→結構的列表：

```json
{
  "resources": {
    "transforms": [
      { "id": 0, "a": 1.0, "b": 0.0, "c": 0.0, "d": 1.0, "x": 0.0, "y": 0.0 }
    ],
    "positions": [
      { "id": 0, "x": 100.0, "y": 200.0 }
    ],
    "bounds": [
      { "id": 0, "x": 0.0, "y": 0.0, "width": 512.0, "height": 256.0 }
    ]
  }
}
```

之後 `place_object`, `define_sprite`, `button`, `dynamic_text` 等結構中的 `position_id`, `bounds_id` 等欄位，就可以簡單地以 ID 參照這些資源。

#### Texture Atlases

來源：`TEXTURE_ATLASES` (`0xF007`) tag。

建議 JSON 結構：

```json
{
  "resources": {
    "textureAtlases": [
      {
        "id": 1,
        "nameSymbolId": 5,
        "name": "MainAtlas",
        "width": 1024.0,
        "height": 1024.0
      }
    ]
  }
}
```

其中 `nameSymbolId` 與 `name` 可以同時保留（前者源自原始結構的 ID，後者是解析後的實際字串）。

---

### `definitions`：Sprite / Graphic / Text / Button 等定義

`definitions` 部分承接 `defines` 與其 children（多個 `define_sprite`, `dynamic_text`, `button`, `graphic` 等），其目的在於：

- 把可重用的 sprite、圖形、文字、按鈕定義集中放在一個可索引區域。
- 將原本拆散在多個 tag/children 中的資訊整理為單一物件。

#### Sprites

來源：

- `DEFINES` (`0xF00D`) 中的計數資訊。
- 多個 `DEFINE_SPRITE` (`0xF027`) tag。
- 每個 sprite 下方的 `FRAME_LABEL`, `FRAME`, `KEYFRAME`, `PLACE_OBJECT`, `REMOVE_OBJECT`, `DO_ACTION` 等 children。

建議 JSON 結構（語義層，省略部份欄位）：

```json
{
  "definitions": {
    "sprites": [
      {
        "characterId": 10,
        "nameSymbolId": 2,
        "name": "Notice_Mode_mc",
        "boundsId": 3,
        "numFrames": 30,
        "numKeyframes": 5,
        "frameLabels": {
          "Intro": 0,
          "Loop": 10
        },
        "timeline": [
          {
            "frameIndex": 0,
            "actions": [
              {
                "type": "placeObject",
                "placementId": 1,
                "characterId": 21,
                "depth": 1,
                "positionId": 0,
                "transformId": 0,
                "colorMultId": 0,
                "colorAddId": 0
              }
            ]
          }
        ]
      }
    ]
  }
}
```

實際導出時，可以先僅保留關鍵欄位（例如 `characterId`, `nameSymbolId`, `boundsId`, `numFrames`，以及每一 frame 的 children），之後再逐步豐富。

#### Graphics, Texts, Buttons

類似設計：

- `definitions.graphics`: 由 `GRAPHIC` tag 收集 mesh 與貼圖相關資訊。
- `definitions.texts`: 由 `DYNAMIC_TEXT` tag 收集文字佈局設定。
- `definitions.buttons`: 由 `BUTTON` tag 收集按鈕的圖形組合與互動區域。

在第一版實作中，可以先只導出必要欄位（ID 以及與資源表的關聯），其餘未知欄位歸類到 `extra` 字典中，以利日後分析。

---

### `timeline`：根時間軸與場景樹

雖然每個 sprite 自帶自己的 timeline，但整個 LMB 檔案通常會存在一個「入口」角色與根時間軸，例如：

- `properties.entry_character_id` 作為 `rootSpriteId`。
- 該 sprite 對應的 timeline 即為整個場景的主時間軸。

建議 JSON 結構：

```json
{
  "timeline": {
    "rootSpriteId": 10,
    "sprites": [
      {
        "characterId": 10,
        "timeline": [
          {
            "frameIndex": 0,
            "displayList": [
              {
                "placementId": 1,
                "characterId": 21,
                "depth": 1,
                "transformRef": { "positionId": 0, "transformId": 0 },
                "colorRef": { "colorMultId": 0, "colorAddId": 0 }
              }
            ],
            "actions": [
              { "type": "doAction", "actionId": 5 }
            ]
          }
        ]
      }
    ]
  }
}
```

這裡的 `timeline.sprites` 可以重用 `definitions.sprites` 中的資料，或者只保留指向定義的引用，實際選擇可依實作便利性決定。

---

### 從 Kaitai 物件到 JSON 的遍歷策略

基於已生成的 `Lmb.js`，在 Node.js / Bun 環境中可以這樣處理：

1. 使用 `Lmb` 解析檔案：

   ```js
   const fs = require("fs");
   const KaitaiStream = require("kaitai-struct").KaitaiStream;
   const { Lmb } = require("./Lmb");

   const buffer = fs.readFileSync("CMN_ALLNET_ICON00.lmb");
   const lmb = new Lmb(new KaitaiStream(buffer));
   const root = lmb.lmb;
   ```

2. 掃描 `root.tags`，依 `tag.tagType` 分類處理：

   - `SYMBOLS`: 建立 `symbols` 陣列。
   - `COLORS`: 建立 `colors` 陣列。
   - `TRANSFORMS`, `POSITIONS`, `BOUNDS`, `TEXTURE_ATLASES`: 各自填入 `resources` 對應欄位。
   - `PROPERTIES`: 讀出 `width`, `height`, `framerate`, `entry_character_id`, `max_character_id` 等，寫入 `meta` 與 `timeline.rootSpriteId`。
   - `DEFINES`: 根據其 `num_children`，對 children 進行分類（`DEFINE_SPRITE`, `DYNAMIC_TEXT`, `BUTTON`, `GRAPHIC` 等）。

3. 對於 `DEFINE_SPRITE`：

   - 建立對應的 sprite 定義物件，記錄其 `character_id`, `name_id`, `bounds_id`, `num_frames`, `num_keyframes`, `num_frame_labels` 等。
   - 遍歷其 children：
     - `FRAME_LABEL`: 建立 `frameLabels` 對應表。
     - `FRAME` / `KEYFRAME` / `SHOW_FRAME`: 為每一 frame 建立 timeline 項目。
     - 在 frame 的 children 中尋找 `PLACE_OBJECT`, `REMOVE_OBJECT`, `DO_ACTION`，並依型別填入 displayList 與 actions。

4. 最後將所有資訊組合成上文設計的 JSON 結構並輸出：

   ```js
   const output = {
     meta,
     resources,
     definitions,
     timeline
   };

   fs.writeFileSync("CMN_ALLNET_ICON00.lmb.json", JSON.stringify(output, null, 2));
   ```

---

### 與 Kaitai Struct Visualizer 的對比與優化

`kaitai_struct_visualizer` 的 raw 視圖主要特點是：

- 忠實反映 KSY 結構與二進位布局，適合研究與除錯。
- 每一層會顯示偏移、長度等底層資訊。
- children 關係純粹由 `repeat` 與 `switch-on` 驅動，沒有額外語義。

我們在設計 LMB→JSON 工具時，則更關注：

- 由多個 tag 彙整出高階概念，例如：
  - 全域 symbol 表。
  - sprite 定義與其時間軸。
  - display list 操作（place/remove object）與事件（do_action）。
- 讓 JSON 使用直覺的欄位命名與結構，方便人類閱讀與修改。

因此，實際導出流程會是：

1. **先依照 Kaitai 結構解析出 raw 物件樹**。
2. **在程式中進行第二階段的「語義加工」**：
   - 建立 ID→物件的映射表（symbols, colors, transforms, positions, bounds 等）。
   - 根據 `tagType` 與 `children` 邏輯，重建 sprite 與 timeline 的關係。
3. **最後才輸出整理後的 JSON**。

這樣做的好處是：

- 不需要修改現有的 `lmb.ksy` 或 Kaitai 生成碼。
- 可以逐步增量改善 JSON 結構，而不影響底層解析。
- 對尚未完全理解的欄位，可以暫時放在 `extra` 或 `unknown` 區塊中，待後續研究。

---

### 未來擴展：JSON→LMB 的逆向生成

雖然目前重點是 LMB→JSON，但在設計 JSON 結構時若事先考慮可逆性，未來要實現 JSON→LMB 會更容易。需要注意：

- 保留所有必要 ID 與計數欄位：
  - `characterId`, `nameSymbolId`, `boundsId`, `positionId`, `transformId`, `colorMultId`, `colorAddId` 等。
  - `numFrames`, `numKeyframes`, `numFrameLabels`, `numGraphics` 等統計欄位。
- 能從 JSON 準確重建 tag 順序與巢狀關係：
  - `defines` → 多個 `define_sprite`。
  - `define_sprite` → 多個 `frame_label` / `frame` / `keyframe`。
  - `frame` → 多個 `place_object` / `remove_object` / `do_action`。
- 正確計算 `data_len`（以 4 bytes 為單位）與 `total_file_len`，並補齊對齊與 padding。

在工具實作層面，可以先從 LMB→JSON 做 round-trip 測試：

1. 解析原始 LMB → JSON。
2. JSON 經過簡單處理（或原封不動）後，嘗試 JSON→LMB 再打包。
3. 比對原始 LMB 與重新打包後的 LMB：
   - 若二進位完全一致，代表格式推測與實作非常精確。
   - 若有差異，則檢查具體差異點（多半是 padding / 旗標 / 排序等細節）。

---

### 小結

本文件提出了一個實用且可擴展的 LMB→JSON 設計方案，核心要點為：

- 以 `meta` + `resources` + `definitions` + `timeline` 四大區塊組織資料。
- 尊重 LMB 原本的 ID 及表格設計，將 symbols/colors/transforms/positions/bounds/textureAtlases 等集中管理。
- 透過遍歷 `Tag` 樹與其 children，重建 sprites、frames、display list 以及腳本動作等高階語義。
- 實作上完全建立在現有 Kaitai 解析器之上，不修改 .ksy，只在第二階段進行語義重組。
在此基礎上，可以逐步實作原型工具（例如 Node.js 腳本）來驗證這個 JSON 結構設計的實際可行性，並視需要做細節調整。未來若要實作 JSON→LMB 的逆向生成，也可以直接沿用這套結構與映射規則。

---

### 基於 JSON 的 HTML 預覽計畫（UI / 動畫）

在 LMB→JSON 結構確立後，我們預期會以此為基礎，實作一套以 HTML 為載體的「預覽 runtime」，用於重現原本 Flash/SWF 風格的 UI 與動畫效果。整體方向如下：

- **基本目標**
  - 在瀏覽器中載入從 LMB 轉出的 JSON。
  - 使用 HTML + CSS + JavaScript（或 Canvas/WebGL）重建一棵場景樹（sprites + children）。
  - 依 `timeline` 與 `framerate` 播放動畫（frame/ keyframe / place/remove object）。
  - 支援簡單互動：例如按鈕 hover / click、切換畫面、觸發基本事件。

- **渲染策略**
  - 第一階段可以使用 DOM + CSS transform：
    - 每個 placeObject 對應成一個 DOM 節點（例如 `div`）。
    - 使用 `transform: translate/scale/rotate` 來套用 position / transform。
    - 顏色與 alpha 透過 `opacity` 或 `filter` 基本實現。
  - 若需要更高擬真度與效能，再逐步改為 Canvas 或 WebGL：
    - 使用 `graphic` + `textureAtlases` 直接繪製 mesh。
    - 支援 blendMode、colorMatrix 等較進階效果。

- **時間軸與互動**
  - 實作一個簡單的 timeline 管理器：
    - 使用 `requestAnimationFrame`，根據 `meta.framerate` 推進當前 frameIndex。
    - 在每一幀套用對應 `placeObject` / `removeObject` / `doAction` 操作，更新場景樹。
  - 將 `button` 與 `bounds` 對應到可點擊區域：
    - 使用 DOM 元素的 `click`/`pointer` 事件作為互動入口。
    - 初期只做簡單回應（例如 highlight / console log），之後再對應到 actionScript 或遊戲邏輯。

- **漸進式精細化**
  - 先完成「可以看懂結構與大致動畫」的 MVP：
    - sprite 的進出與位移。
    - 主要文字、按鈕位置與顏色。
  - 後續若需要更高還原度，再根據實驗結果擴充分類：
    - 更完整的文字排版（dynamic_text）。
    - 更準確的 blendMode、colorMatrix、filter 效果。
    - 部分 actionScript 行為的模擬（例如簡單的 gotoAndPlay/gotoAndStop）。

透過這樣的分階段設計，我們可以先用現有 JSON 結構快速驗證 UI / 動畫預覽的可行性，再逐步增加還原度，而不需要一開始就完全重現原本引擎的所有細節。



