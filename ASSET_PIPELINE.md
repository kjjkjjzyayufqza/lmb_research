# Asset pipeline: LMB, JSON, NUTEXB, and preview

This document describes the **lmb_research** repository, how to convert **`.lm` / `.lmb` ↔ JSON**, how to turn **NUTEXB** into images for the **preview** app (using **ultimate_tex** at `E:\research\ultimate_tex`), and how to line up file names with `textureAtlases` in the JSON.

Code and file names in commands stay in English. Tooling paths below use Windows-style examples; adjust drive letters and folders for your machine.

---

## 1. What this project is

| Area | Role |
|------|------|
| **Root (`lmb_research/`)** | Research and CLI-style tools around the LMB binary format: `lmb.ksy`, generated `Lmb.js`, `lmbast.ts` (AST), **`lmbtojson.ts`**, `jsontolmb.ts`, and design notes (`LMB分析.md`, `LMBtoJSON.md`, `preview_develop.md`). |
| **`preview/`** | Vite + React + WebGL app that loads a **LMB JSON** file and plays the timeline. It does **not** read `.lmb` or `.nutexb` directly. |
| **External: `E:\research\ultimate_tex`** | Separate Rust project: **Smash Ultimate**-oriented texture tools. Use **`ultimate_tex_cli`** to convert **`.nutexb` → `.png` / `.dds`**, which the preview can consume as static PNGs. |

---

## 2. Prerequisites

- **Bun** (for `bun lmbtojson.ts` / `bun jsontolmb.ts`). From repo root: `bun install`.
- **Node** (for the `preview` app): install deps under `preview/` and use Vite as documented in `preview/package.json` (e.g. `npm run dev` in `preview/`, or your usual command—do not rely on a server started from the AI agent; run it locally as needed).
- **Rust toolchain** (optional, for building **ultimate_tex**): to build `ultimate_tex_cli` from `E:\research\ultimate_tex` per that repo’s `README.md`.

---

## 3. Convert `.lm` / `.lmb` → JSON

The converter reads a single binary file and writes **`<same_basename>.json`** next to the input file (same directory).

```bash
# From the lmb_research repository root
bun lmbtojson.ts "path\to\title_ef_0093.lm"
```

- Extension can be **`.lmb` or `.lm`**; the important part is the file content being valid LMB.
- Output: `path\to\title_ef_0093.json`.
- Implementation: `lmbtojson.ts` (semantic JSON layout) with `lmbast.ts` + Kaitai-based parsing.

JSON shape is specified in **`LMBtoJSON.md`**. High-level fields: `meta`, `resources` (including **`textureAtlases`**), `definitions`, `timeline`.

---

## 4. (Optional) Convert JSON → `.lmb`

Tool: **`jsontolmb.ts`**. It encodes **`parsed.ast`** with `encodeLmbAst` and writes a `.lmb` file.

**Important:** The input JSON must contain a top-level **`.ast`** object (see `jsontolmb.ts`). The current **`lmbtojson.ts`** output is **semantic** LMB JSON and does **not** embed this AST blob, so you **cannot** round-trip a typical `lmbtojson` file through `jsontolmb.ts` without a separate export that includes `.ast`. Use this only when you have JSON that was produced for round-trip (or extended tooling) with an `ast` field.

```bash
bun jsontolmb.ts "path\to\file.json" [output.lmb]
```

If you omit the second argument, the output defaults to `same_basename.rebuild.lmb` next to the input.

---

## 5. NUTEXB → PNG (ultimate_tex at `E:\research\ultimate_tex`)

The **lmb_research** repo does **not** include a NUTEXB decoder. Use **ultimate_tex** (clone/build at `E:\research\ultimate_tex`).

### 5.1 Build the CLI (once)

From `E:\research\ultimate_tex` (see upstream **`README.md`** for platform notes):

```bash
cargo build --release -p ultimate_tex_cli
```

The binary is typically:

- `E:\research\ultimate_tex\target\release\ultimate_tex_cli.exe` (Windows)

### 5.2 Single-file NUTEXB → image

From **ultimate_tex** `README.md`:

- To PNG (example):

  ```text
  ultimate_tex_cli def_mario_001_col.nutexb out.png
  ```

- To DDS as an intermediate (also valid for preview if you add a different loader; the current **preview** stack loads **PNG** via `loadImage`):

  ```text
  ultimate_tex_cli def_mario_001_col.nutexb img.dds
  ```

- Inspect NUTEXB metadata only (no output file; `--info` omits the need for a second path):

  ```text
  ultimate_tex_cli some.nutexb --info
  ```

For full flags, run `ultimate_tex_cli --help` in your build.

### 5.3 Use internal name in the output filename (important for LMB preview)

`ultimate_tex_cli` can replace `*` in the **output** path with the **NUTEXB footer string** (internal name). That helps match files to **`textureAtlases[].name`** inside the JSON.

Example pattern:

```text
ultimate_tex_cli "E:\path\to\texture.nutexb" "E:\out\*.png"
```

The `*` becomes the NUTEXB internal name; use that to align names with the LMB JSON (see next section).

---

## 6. Match PNG file names to LMB JSON `textureAtlases`

The WebGL preview resolves atlas files in **`loadAtlasTextures`** (`preview/src/lib/render/webgl.ts`):

- For each atlas, the file name is:
  - **`atlas.name`** (e.g. `Mask.png`) if present, **or**
  - **`img-00000.png`**, `img-00001.png`, … if `name` is missing (zero-padded index).

**Recommended workflow:**

1. Open the generated `*.json` and inspect `resources.textureAtlases` (each entry: `id`, `name`, `width`, `height`, etc.).
2. For each NUTEXB that corresponds to an atlas, export PNGs so the **on-disk file name** equals **`name`** from JSON (case and extension must match what the browser will request).
3. If you rely on the `*.png` wildcard feature of `ultimate_tex_cli`, check that the resolved name matches `atlas.name`; rename if your game’s packing used different strings.

**Known pain point (see `todo.md` / `progress.md`):** manually naming `img-00000.png` while JSON carries real names like `Mask.png` will break loading. Prefer **`atlas.name`**-based naming.

---

## 7. Run the preview and load assets

### 7.1 How the app loads data

- **JSON:** User action **“Open JSON”** in the UI; the file is read in the browser from the file picker (`preview/src/App.tsx`).
- **Textures:** The app requests images under a fixed URL prefix **`textures/`** (see `loadAtlasTextures(..., "textures/")`). With Vite, that maps to static files in **`preview/public/textures/`** served at `http://localhost:<port>/textures/...`.

The browser **does not** auto-load a folder of PNGs next to the JSON file on disk. You must either:

- Copy **`*.json`** into `preview/public/` (optional, for convenience) and copy all PNGs into **`preview/public/textures/`** with the correct names, then open the JSON through **Open JSON** (or open the public copy), **or**
- Run a local static server that exposes `/textures/...` with the same names the JSON expects (advanced; default workflow is `public/textures`).

### 7.2 Suggested layout for one effect (e.g. `title_ef_0093`)

After generating `title_ef_0093.json` and all PNGs:

1. `preview/public/title_ef_0093.json` (or keep JSON elsewhere and only ensure textures are under `public/textures/`)
2. `preview/public/textures/<exact names from textureAtlases.name>.png`
3. Start the preview dev server from **`preview/`**, open the app, **Open JSON** → select your `title_ef_0093.json`.

### 7.3 Playback

- The app builds a **`ResourceStore`**, **`Scene`**, and **`TimelinePlayer`** from `timeline.rootSpriteId` and sprite definitions; you can switch root sprite from the header dropdown when multiple sprites exist.

---

## 8. End-to-end checklist (example: `title_ef_0093`)

1. **LMB → JSON:**  
   `bun lmbtojson.ts "...\flash\shogo\effect\title_ef_0093\title_ef_0093.lm"`
2. **NUTEXB → PNG:**  
   For each NUTEXB, run `ultimate_tex_cli` and name outputs to match `textureAtlases[].name` in the new JSON.
3. **Copy into preview static dir:**  
   Put PNGs in `lmb_research/preview/public/textures/`.
4. **Open JSON** in the preview UI and confirm network tab shows **200** for every texture URL.
5. If something is off, compare **`meta.width` / `meta.height`**, sprite **`timeline`**, and **WebGL** logs (see `progress.md` for known coordinate issues on some files).

---

## 9. Related documents (in this repo)

| File | Content |
|------|---------|
| `LMB分析.md` | High-level LMB format notes |
| `LMBtoJSON.md` | JSON field design |
| `preview_develop.md` | Preview goals and runtime mapping |
| `lmbtojson.ts` | Actual converter implementation |
| `todo.md` / `progress.md` | Open issues (nutexb naming, WebGL offset, etc.) |

---

## 10. ultimate_tex reference (external)

- Repository: [ScanMountGoat/ultimate_tex](https://github.com/ScanMountGoat/ultimate_tex)  
- Your local copy: `E:\research\ultimate_tex` (GUI: **ultimate_tex**; batch one-off files: **ultimate_tex_cli**)

This pipeline is for **Smash Ultimate–style** NUTEXB. If a specific game’s NUTEXB variant fails to decode, check format support in that tool’s issues or use another converter—**the preview only needs correctly sized PNGs whose names match the JSON.**
