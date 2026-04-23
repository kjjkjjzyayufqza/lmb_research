# lmb_research

研究 **LMB**（`.lm` / `.lmb`）二進位格式與預覽流程：Kaitai 定義、`lmbtojson.ts` 語意 JSON、以及與 **NUTEXB → PNG**（外部工具）對齊的資產管線。

---

## 環境需求

| 工具 | 用途 |
|------|------|
| [Bun](https://bun.sh) | 執行 `lmbtojson.ts`（須在 `PATH` 中） |
| （可選）`ultimate_tex_cli` | 將 `textures\*.nutexb` 轉成依內部名稱命名的 PNG |

安裝本倉庫依賴（倉庫根目錄）：

```bash
bun install
```

`ultimate_tex_cli` 來自獨立專案 [ultimate_tex](https://github.com/ScanMountGoat/ultimate_tex)；預設批次檔假設 Windows 路徑為 `E:\research\ultimate_tex\target\release\ultimate_tex_cli.exe`，可透過環境變數覆寫（見下）。

---

## 快速轉檔：`convert_assets.bat`（Windows）

將 **一個或多個** `.lm` / `.lmb` 檔拖放到倉庫根目錄的 **`convert_assets.bat`** 上即可。

### 行為說明

1. **LMB → JSON（一定會做）**  
   對每個拖入的 `.lm` / `.lmb`，在**與該檔相同目錄**寫入同主檔名的 `.json`（呼叫 `bun lmbtojson.ts`）。

2. **NUTEXB → 具名 PNG（可選）**  
   僅當**該 LMB 檔的同级目錄**下存在 **`textures`** 資料夾，且其中含有 **`*.nutexb`**，且本機上找得到 `ultimate_tex_cli` 時，才會對每個 `nutexb` 執行轉檔，輸出到同一 `textures` 目錄，檔名使用工具之 `*.png` 規則（`*` 替換為 NUTEXB 內部名稱），以便與 JSON 的 `resources.textureAtlases[].name` 對齊。  
   若沒有 `textures`、沒有 `nutexb`、或沒有 CLI，則**略過**並在畫面上標示 `SKIP`。

3. **非 LMB 副檔名**  
   會顯示 `SKIP` 並處理下一個拖入的檔案。

### 指定 `ultimate_tex_cli` 路徑

在執行前於 **命令提示字元** 或 **PowerShell** 設定（範例）：

```bat
set ULTIMATE_TEX_CLI=D:\tools\ultimate_tex\target\release\ultimate_tex_cli.exe
```

然後從該視窗啟動檔案總管再拖放，或先 `cd` 到倉庫根目錄後執行：

```bat
set ULTIMATE_TEX_CLI=D:\path\to\ultimate_tex_cli.exe
convert_assets.bat "E:\assets\effect\title_ef_0093.lm"
```

未設定時使用批次檔內建預設路徑 `E:\research\ultimate_tex\target\release\ultimate_tex_cli.exe`。

### 建議的 effect 目錄結構（與批次檔邏輯一致）

```text
title_ef_0093\
  title_ef_0093.lm          ← 拖這個（或 .lmb）
  textures\                 ← 可選；有則轉 nutexb
    foo.nutexb
    bar.nutexb
```

執行後：

```text
title_ef_0093\
  title_ef_0093.json        ← 與 .lm 同級
  textures\
    <internal-name>.png     ← 由 ultimate_tex_cli 命名
```

---

## 手動指令（與批次檔對照）

僅轉 JSON（倉庫根目錄）：

```bash
bun lmbtojson.ts "path\to\file.lm"
```

完整管線說明（JSON 欄位、preview 靜態目錄、`textureAtlases` 對齊等）見 **`ASSET_PIPELINE.md`**。

---

## Preview 應用（`preview/`）

Vite + React + WebGL，從 **語意 JSON** 播放時間軸；不直接讀 `.lmb` / `.nutexb`。將 JSON 與 PNG 依 `ASSET_PIPELINE.md` 放入 `preview/public/` 與 `preview/public/textures/` 後再於本機開啟預覽。

---

## 其他腳本

| 檔案 | 說明 |
|------|------|
| `jsontolmb.ts` | JSON（需含 `.ast`）→ `.lmb`；一般 `lmbtojson` 輸出不含 `ast`，不可直接回轉，見 `ASSET_PIPELINE.md` |
| `lmb.ksy` / `Lmb.js` | Kaitai 結構與產生之解析程式 |

---

## 授權與來源

本倉庫為研究用工具集合；`ultimate_tex` 為獨立專案，請遵循其授權條款。
