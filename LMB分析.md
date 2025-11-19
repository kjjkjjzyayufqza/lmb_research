### LMB 格式概觀

本文件根據 `lmb.ksy` 以及 Kaitai Struct 的解析結果，對 LMB 資料格式做初步分析與推測，目標是協助後續實作工具（例如 LMB→JSON、重建工具或可視化工具）時，有一份可參考的結構說明。

從現有資料來看，LMB 很明顯是一種「標籤式（tag-based）」的動畫／UI 資源格式，整體風格高度類似 Flash/SWF，但已經針對遊戲引擎與 GPU 渲染做過壓縮與優化。

---

### 文件整體結構

根據 `lmb.ksy`，一個獨立的 `.lmb` 檔案可以簡化描述為：

- 文件本體對應型別：`lmb_type`
- 額外的工具型別：`tag`、`symbols`、`colors`、`transforms`、`positions`、`bounds`、`texture_atlases`、`properties`、`define_sprite`、`frame`、`place_object`、`dynamic_text` 等。

`lmb_type` 的順序結構如下（以欄位名為準，實作中皆為小端序）：

- `magic`: 固定字串 `"LMB\0"`，用來驗證格式。
- `textureId` (`texture_id`): 一個 `u4`，可能是外部貼圖資源的索引或 ID。
- `resourceId` (`resource_id`): 一個 `u4`，推測為此資源在整個資源系統中的 ID。
- `xmdPadding` (`xmd_padding`): 4 bytes，型別為 `nothing`，原本在 LMD/XMD 容器裡用來對齊的空間，對純 LMB 解析器來說可以視為無意義保留欄位。
- `numPadding` (`num_padding`): `u4`，後面 padding 區塊的個數。
- `unknown4`, `unknown5`: 兩個 `u4`，用途尚未確定，可能與版本、旗標或校驗相關。
- `totalFileLen` (`total_file_len`): `u4`，代表 LMB 資料段的總長度（以 byte 為單位），可用於限制 tag 區塊的解析範圍。
- `padding`: 長度固定為 `0x10` bytes 的區塊，重複 `numPadding` 次，作用多半是對齊或預留空間。
- 之後緊接著就是 tags 區段，對應 `tag` 型別的重複序列。

以 Kaitai Visualizer 顯示的 raw 結果為例（僅截取部份）：

```text
lmb [LmbType]
magic = [76, 77, 66, 0]
textureId = 0x10 = 16
resourceId = 0x10010200 = 268501504
xmdPadding [Nothing]
numPadding = 0x2 = 2
unknown4 = 0x0 = 0
unknown5 = 0x0 = 0
totalFileLen = 0x1C24 = 7204
padding
  0 = [0, 0, 0, 0, ...]
  1 = [0, 0, 0, 0, ...]
tags
  0 [Tag]
  1 [Tag]
  ...
```

可以看出 header 與 padding 結束後，就是一串 `Tag` 物件所組成的清單。

---

### Tag 系統與類型劃分

`tag` 型別是 LMB 的核心結構，每一個 tag 代表一種指令或資料區塊。其基本欄位為：

- `tag_type` (`tagType`): `u2`，對應枚舉 `flash_tag_type`。
- `offset`: `u2`，目前觀察永遠為 `0`，Kaitai 中對此做了 `valid: any-of: [0]` 檢查，可視為保留欄位。
- `data_len` (`dataLen`): `u4`，資料長度單位是「以 4 bytes 為一組的數量」，也就是實際 bytes 數 = `data_len * 4`。
- `data`: 根據 `tag_type` 做 switch，解析成對應的型別（例如 `symbols`、`colors`、`positions` 等），長度固定為 `data_len * 4`。
- `children`: 一組遞迴子 tag 清單，用於表達層次結構（例如 `defines`、`define_sprite`、`frame` 等會擁有自己的子 tag）。

`flash_tag_type` 中同時包含「原生 Flash tag」與「自訂 tag」：

- 原生／類 Flash tag：
  - `show_frame`
  - `place_object`
  - `remove_object`
  - `fonts`
  - `do_action`
  - `dynamic_text`
  - `define_sprite`
  - `frame_label`
- 自訂 tag（高位段 `0xF0xx` 與 `0xFFxx`）：
  - `symbols` (`0xF001`)
  - `colors` (`0xF002`)
  - `transforms` (`0xF003`)
  - `positions` (`0xF103`)
  - `bounds` (`0xF004`)
  - `action_script` (`0xF005`)
  - `action_script_2` (`0xFF05`)
  - `keyframe` (`0xF105`)
  - `texture_atlases` (`0xF007`)
  - `properties` (`0xF00C`)
  - `defines` (`0xF00D`)
  - 以及數個 `unknown_F00x` 類型。

這種設計非常適合作為「流式解析的擴展格式」：舊版引擎可以忽略不認識的 tag，而新版引擎則可以利用更多自訂 tag 提供的資料。

---

### 重要資料表型別概覽

下列幾種 tag 對應的資料表，在實際使用中很可能是其他 tag 所依賴的基礎資源。

- `symbols`（字串資源表）
  - 結構：`num_values` + 多個 `string`。
  - 每個 `string` 包含 `len`、`value`（UTF-8 字串）與 padding。
  - 作用推測：
    - 存放 symbol 名稱（例如元件名、sprite 名稱）。
    - 存放文字資源（例如 UI 顯示字串）。
  - 在範例中可以看到：
    - `"lmf"`, `"Notice_Mode_mc"`, `"Start"` 等，很像 Flash 元件或導演剪輯裡的 symbol 名稱。

- `colors`（顏色表）
  - 結構：`num_values` + 多個 `color`。
  - `color` 包含 `r`, `g`, `b`, `a`，每個分量是 `u2`。
  - 作用推測：集中管理常用顏色，後續透過 ID（索引）引用，節省重複儲存。

- `transforms`（矩陣表）
  - 結構：`num_values` + 多個 `matrix`。
  - `matrix` 包含 `a, b, c, d, x, y`，皆為 `f4`。
  - 這與 2D 變換矩陣（scale/rotation/skew + translation）完全對應。

- `positions`（位置表）
  - 結構：`num_values` + 多個 `position`。
  - `position` 包含 `x, y` 兩個 `f4`，也就是一組平面座標。

- `bounds`（矩形邊界表）
  - 結構：`num_values` + 多個 `rect`，每個記錄 `x, y, width, height`。
  - 作用推測：
    - sprite 或按鈕的邊界框（hit area）。
    - 視覺裁剪或顯示區域。

- `texture_atlases`（貼圖集資訊）
  - 結構：`num_values` + 多個 `texture_atlas`。
  - 每個 atlas 記錄 `id`, `name_id`, `width`, `height`。
  - 搭配 `graphic` tag（帶有 `vertices` / `indices`）使用，可以表達單個 mesh 在 atlas 上的 UV 分布。

- `properties`
  - 包含 `max_character_id`, `entry_character_id`, `max_depth`, `framerate`, `width`, `height` 等欄位。
  - 其中 `entry_character_id` 很可能是「入口 sprite ID」，`framerate`、`width`、`height` 則是與舞台設定相對應。

---

### 時間軸與層次結構相關型別

LMB 中與「動畫時間軸」密切相關的型別包括：

- `defines`
  - 記錄 `num_shapes`, `num_sprites`, `num_texts` 等總數。
  - `num_children` 為上述幾者總和，後續會有對應數量的子 tag（例如具體的 shape 或 sprite 定義）。

- `define_sprite`
  - 描述一個 sprite 的基本屬性：
    - `character_id`: sprite 的 ID。
    - `name_id`: 對應 `symbols` 表的字串 ID（sprite 名稱）。
    - `bounds_id`: 對應 `bounds` 表的 ID。
    - `num_frame_labels`, `num_frames`, `num_keyframes` 等。
  - 此 tag 之後緊接著會出現 `frame_label`, `frame`, `keyframe` 等 tag 作為 children，構成 sprite 自己的時間軸。

- `frame` / `keyframe` / `show_frame`
  - `frame` 包含 `id` 與 `num_children`，children 直接跟在後面，型別多半是 `place_object`、`remove_object` 或 `do_action`。
  - `keyframe` 也是 frame 的一種，只是額外被標記為關鍵影格（方便工具或引擎快速定位）。

- `place_object`
  - 包含 `character_id`, `placement_id`, `name_id`, `placement_mode`, `blend_mode`, `depth` 等欄位，外加 `position_id`, `position_flags`, `color_mult_id`, `color_add_id`。
  - 這與 Flash 的 PlaceObject 標籤高度相似，用於在舞台或 sprite 上放置一個顯示物件，並指定其層次、位置、顏色等。

- `button` / `graphic` / `dynamic_text`
  - `button`：對應可互動按鈕，具有 `track_as_menu`, `bounds_id`, `num_graphics` 等欄位。
  - `graphic`：包含頂點、索引與 UV，直接可用於 GPU 繪製。
  - `dynamic_text`：包含文字 placeholder、對齊方式、字型／描邊資訊等。

整體來看，tag 的 children 機制使得 LMB 可以在單一線性資料流中表示出多層次的結構，例如：

- `defines` 底下有多個 `define_sprite`。
- 每個 `define_sprite` 底下再有多個 `frame` / `keyframe`。
- 每個 `frame` 底下再有多個 `place_object` / `remove_object` / `do_action` 等。

這種樹狀結構，非常適合表示 UI 或 2D 動畫的場景樹與時間軸。

---

### 與 Flash / SWF 風格引擎的關係與推測

從 tag 名稱與語義來看，LMB 與 Flash/SWF 的關聯相當明顯：

- `define_sprite`, `frame`, `keyframe`, `frame_label`, `place_object`, `remove_object`, `do_action`, `dynamic_text`, `fonts` 等，幾乎都能在 SWF 規格中找到對應。
- `action_script` / `action_script_2` 也暗示原始資源中曾經包含某種腳本語言（很可能就是 ActionScript），只是在導出到 LMB 後變成更精簡的 bytecode 或引用形式。

再加上 LMD/XMD 外層容器的結構，可以合理推測整個管線可能是：

1. 美術與策劃在 Flash 或類似編輯器中製作 UI / 動畫。
2. 專用導出工具將 SWF 或專案轉換為 LMD/LMB/XMD。
3. 遊戲執行時只讀這些導出的二進位格式，不再載入 SWF。

LMB 在 Flash 的概念上進一步做了這些優化：

- 把矢量圖轉換為 mesh（`graphic` + `vertices` + `indices`），並搭配 `texture_atlases` 做貼圖打包，以利 GPU 渲染。
- 將文字、顏色、位置、矩陣等統一集中為表格，改以 ID 參照，節省空間並提高 cache 命中率。
- 使用 `data_len` + `tag_type` 的 tag 機制，使得引擎可以順序掃描整個檔案而不需要複雜的隨機存取。

---

### Kaitai Visualizer 的 raw 視圖與實際語義

Kaitai Struct Visualizer 顯示的 raw 樹狀結構非常適合做「觀察」，但直接用來當最終資料模型會顯得冗長，因為：

- 每一層都顯示 `offset`, `dataLen`、各種中間型別名稱（例如 `String`, `Color`, `Rect`），這些對工具實作者來說很重要，對上層邏輯則較為雜訊。
- `children` 是純粹遞迴結構，缺乏語義：「這個 children 是 sprite 的 frame？還是 frame 里的 display list 操作？」。

例如片段：

```text
tags
0 [Tag]
  tagType = SYMBOLS (0xF001)
  data [Symbols]
    numValues = 9
    values
      0 [String]
      1 [String]
      2 [String]
        len = 0xE = 14
        value = Notice_Mode_mc
        padding [Nothing]
...
1 [Tag]
  tagType = COLORS (0xF002)
  data [Colors]
    numValues = 10
    values
      0 [Color]
        r = 0x100
        g = 0x100
        b = 0x100
        a = 0x100
      1 [Color]
        r = 0x0
        g = 0x0
        b = 0x0
        a = 0x0
...
```

從這樣的 raw 輸出，我們可以推導出更高層的語義：

- `symbols` tag 可以被轉換為 `symbols: string[]` 或 `symbolTable: { id: number, name: string }[]`。
- `colors` tag 可以被轉換為 `colors: { r: number, g: number, b: number, a: number }[]`。
- 之後 `define_sprite`, `place_object`, `dynamic_text` 等會透過各種 `*_id` 來引用這些表。

未來在設計 LMB→JSON 工具時，我們可以以這種「從 raw 結構萃取語義」的方式，將資料整理成更乾淨易懂的 JSON。

---

### 格式設計動機的綜合推測

綜合以上觀察，可以推測 LMB 格式的設計動機包括：

- **順序與流式解析**：使用 tag + 長度，使得引擎只需單向掃描，無需大量隨機存取。
- **易於擴展與相容**：透過保留 `offset` 欄位與自訂的高位 tag，舊版引擎可以簡單略過未知 tag，新版引擎則能利用更多資訊。
- **資源共享與重用**：symbols/colors/transforms/positions/bounds/texture_atlases 等基礎資源集中管理，通过 ID 引用，減少重複資料。
- **GPU 友好**：採用 vertices + indices + UV 的 graphic 結構，搭配 texture atlas，利於在遊戲中直接餵給渲染管線。
- **沿用 Flash 概念，降低工具鏈成本**：維持 define_sprite / frame / keyframe / frame_label / place_object / do_action / dynamic_text 等語義，使原本基於 Flash 的內容與流程能較容易移植。

這些特性也決定了我們在設計 LMB 分析與轉換工具時，應該盡量尊重原本的 tag 結構與 ID 參照關係，而不是單純「展平成一堆無關聯的數組」。

---

### 後續工作與可行方向

在這份 LMB 結構分析的基礎上，可以進一步發展：

- LMB→JSON 轉換工具：將 tag 樹轉換為高階 JSON 模型，方便檢查與 diff。
- LMB 視覺化工具：基於 JSON 模型呈現 sprites、時間軸、display list 層級、碰撞框等。
- JSON→LMB 組裝工具：在完全掌握欄位語義後，實作可逆的編解碼流程，達到修改 JSON 後重新打包為 LMB 的效果。

接下來的 `LMBtoJSON.md` 將專注於設計一個實際可實作的 LMB→JSON 方案與資料結構。


