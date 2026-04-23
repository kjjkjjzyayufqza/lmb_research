# Progress

## 2026-04-23（MachineSelect 完整数据驱动交互实现）

### MachineSelectController — 真实数据驱动的 UI 交互

实现了从游戏数据 → LumenController → Sprite 树的完整数据绑定流程：

**LumenController (lumen_controller.ts)**:
- `resolvePath(path)` — 路径式 MovieClip 解析（支持深度搜索）
- `gotoAndStopByLabel/gotoAndStopByFrame/gotoAndPlayByLabel` — 三个核心控制函数
- `setNumberDisplay` — 数字逐位显示
- `listAllPaths` — 调试用完整路径列表

**MachineSelectController**:
- 195 个真实角色数据（ガンダム、シャア専用ゲルググ、アッガイ...）
- 选中机体时更新 Cost_mc、CostNum_mc、Mastery_mc、Charge_mc 等 sprite 状态
- 10 个面板 Panel01-10_mc 分页管理
- 方向箭头 SelectArrow_Up/Down_mc 状态跟踪

**MachineSelectPanel (React 组件)**:
- 搜索过滤（名称/Cost/ID）
- 195 机体列表带 Cost 颜色标记（1500=绿, 2000=蓝, 2500=黄, 3000=红）
- 键盘导航：↑↓ 选择，←→ 翻页，Enter 确认，O 打开
- Page 导航显示
- Controller Log 实时显示

**machineselect Sprite 路径映射（完整符号表确认）：**
- `Cost_mc` / `CostNum_mc` — Cost 显示（Cost1500-3000 标签）
- `Mastery_mc` / `Mastery_S_mc` — 熟练度（Mastery01-21 / Non）
- `MachineNew_mc` — NEW 标记
- `Charge_mc` — 充能状态
- `Panel01-10_mc` — 机体选择面板（On/Off 状态）
- `Weapon_mc` + `Weapon_01-05_mc` — 武器面板
- `MS_MN_mc` — 机体名称
- `PilotName_mc` — 驾驶员名
- `Timer_mc` — 计时器
- `Select_mc` — 选择框动画
- `SelectArrow_Up/Down/Left/Right_mc` — 方向箭头

---

## 2026-04-23（代码审计 + 完整开发路线图）

### 代码全面审计结论

对 `preview/src/` 全部核心模块进行了严格审计，发现 **5 个 Critical 级问题**、**10 个 Important 级问题**、**5 个 Nice-to-have**。

**Critical（阻断性）:**
1. TextDef 完全不渲染（WebGL 跳过 text 实例）
2. Stage 点击检测坐标系与实例变换不一致（中心 vs 左上角原点）
3. AS2 VM `_root` 指向 `this` 而非根时间轴，缺少 `_parent`
4. AS2 VM `InitArray`/`InitObject` 构造无效（push undefined）
5. AS2 VM `ActionStringExtract` 未实现（子串操作错误）

**Important:**
- `nextFrame`/`prevFrame` 不同步显示列表
- `SetProperty` 仅 `_alpha/_visible` 生效，`_x/_y` 等无效
- `SetTarget`/`With` 被跳过
- `duplicateMovieClip` placementId 碰撞风险
- 关键帧加速路径假设可能失败
- devFixture 异步竞态
- 按钮仅 `graphics[0]`，无四状态模型

**架构评估：** 基础框架（Scene/Player/ActionInterpreter/WebGLRenderer）设计良好，但与真实 Lumen 引擎的差距主要在 AS2 VM 完整性和文本渲染。要实现 machineselect 完整交互，最关键的是 **LumenController 模拟层** + **TextDef 渲染** + **路径式 MC 解析**。

---

## 2026-04-23（最新：多 GUI 自主探索 + machineselect + staffroll）

### 自主探索測試結果

#### staffroll（制作人員名單 — 非交互式動畫）
- **路徑:** `E:\XB\解包\vs2\bak\009gui\flash\staff_roll\staffroll`
- **規模:** 6.4MB JSON, 262KB LM, 91 紋理, 92 sprites, 140 texts, 91 buttons
- **Root Sprite 414:** 3496 幀 (58 秒 @60fps)
- **標籤:** `start:1`, `wait:2961`, `end:2962`, `cancel_end:3454`
- **特點:** 純動畫播放，無交互邏輯
- **測試結果:** ✅ 動畫自動播放正常（890→1902 幀/5s），GUNDAM VERSUS logo 渲染正確
- **已知問題:** ⚠️ TextDef 實例不渲染（231 個 text 實例無法顯示，WebGL 渲染器不支持文本）

#### machineselect（機體選擇界面 — 交互式 GUI）
- **路徑:** `E:\XB\解包\vs2\bak\009gui\flash\game\machineselect\machineselect`
- **規模:** 406KB LM, 187 紋理, 81 sprites, 186 buttons, 2 texts
- **Root Sprite 455:** 1 幀容器（嵌套 sprite 驅動交互）
- **關鍵標籤:**
  - 動畫控制: Start/Wait/End, Open/Close/Select/FadeOut
  - 機體 Cost: Cost1500, Cost2000, Cost2500, Cost3000, CostRandom
  - 熟練度: Mastery01-21, Non
  - 數字顯示: Num0-Num9 (多個 sprite)
  - 狀態: On/Off, Charge/Non, New/Update/Non
- **測試結果:** ✅ 797 個顯示實例正確渲染，包括選擇光標、"NEW" 標籤、網格布局
- **特點:** 高複雜度交互界面（對比 lm_menu 的 74 實例）

#### GUI 目錄全景
| 類別 | 子目錄 | LM 數 | 特點 |
|------|--------|--------|------|
| attract | 6 | 7 | 標題/吸引模式（title.lm 2.1MB 最大） |
| common | 2 | 3 | 通用元素 |
| display_object | 2 | 2 | 菜單 (lm_menu) |
| game | 8 | 16 | 遊戲內 UI（briefing/continue/courseselect/machineselect/training/vs） |
| ingamehud | 3 | 437 | 戰鬥中 HUD |
| livemonitor | 7 | 27 | 觀戰監視器 |
| navi | 3 | 539 | 導航提示 |
| pilot | 200 | 515 | 駕駛員相關 |
| shogo | 4 | 246 | 特效（title_ef_*） |
| staff_roll | 2 | 2 | 制作人員名單 |
| tag | 3 | 102 | 標籤系統 |

### Lumen 引擎架構（IDA 逆向確認）

#### LMB 確認為純 UI 模板系統 — 需要 C++ 數據驅動

用戶假設正確：**LMB 是純 UI skin/template 系統**，Lumen 引擎本身不包含業務邏輯。遊戲的 C++ 代碼充當 **Controller**，負責向 Lumen UI 注入數據。

#### C++ → Lumen 數據通信機制

**三個核心 Lumen 控制函數（地址已確認）：**

| 函數 | 地址 | 作用 | 示例 |
|------|------|------|------|
| `LumenGotoAndStopByLabel` | `0x14030BCB0` | 路徑 + 標籤名跳轉 | `(player, "/icon_mc/net_mc", "net_on")` |
| `LumenGotoAndStopByFrame` | `0x14030C120` | 路徑 + 幀號跳轉 | `(player, "/icon_mc/card_mc", cardType + 1)` |
| `LumenReplaceText` | `0x14030C720` | 替換動態文本 | `(player, "/Credit_Dt_mc")` |

**MovieClip 路徑引用模式：**
```
/display_object_mc/icon_mc/net_mc          → gotoAndStop("net_on" / "net_off")
/display_object_mc/icon_mc/card_mc         → gotoAndStop(frameNumber)
/display_object_mc/Credit_Dt_mc            → gotoAndStop("On"/"Non") + 寫入文本
/display_object_mc/Credit_Dt_mc/dt_credit_0 → 動態文本字段
%s/MachineIcon_%02d_mc                     → 動態索引的機體圖標
%s/MasteryStar_%02d_mc                     → 動態索引的熟練度星星
%s/Burst_mc                                → 爆發類型顯示
%s/P1_mc/PlayerName1_mc/dt00              → 玩家名稱文本字段
```

**數字顯示機制：**
- Sprite 中 `Num0`-`Num9` 標籤 → C++ 對每個位數的 MC 調用 `gotoAndStop("Num3")` 來顯示數字 "3"
- 路徑如 `/NoticeNumSet_S_%d_mc` 按位數動態生成

**Flash ExternalInterface 雙向通信：**
- AS2 → C++: `flash.external.ExternalInterface.call()` 調用 `CallEffect` 回調
- C++ → AS2: 通過 `LumenGotoAndStopByLabel` / `LumenGotoAndStopByFrame` 設置狀態

#### HUD 類體系（C++ Controller 層）

每個遊戲畫面有對應的 C++ HUD 類驅動 Lumen UI：
- `COutHudMachineSelect` — 機體選擇 → 驅動 machineselect.lm
- `COutHudLmMenu` — 主菜單 → 驅動 lm_menu.lm
- `COutHudGamemodeSelect` — 遊戲模式 → 驅動 gamemodeselect.lm
- `COutHudBriefing` — 任務簡報 → 驅動 briefing.lm
- `COutHudVs` — VS 畫面 → 驅動 vs.lm
- `COutHudCourseSelect` — 場地選擇 → 驅動 courseselect.lm
- `CInHudGui` — 戰鬥中 HUD → 驅動 ingamehud/*.lm

#### machineselect 數據驅動分析

C++ `COutHudMachineSelect` 使用以下遊戲數據：
- `selectable_ms_id` — 可選機體 ID 列表
- `burst_type` — 爆發類型（映射到 Burst_mc 標籤）
- `ms_skill1/2` — 機體技能
- `ms_used_num` — 使用次數
- `cost` — 機體 Cost（映射到 `Cost1500/2000/2500/3000/CostRandom` 標籤）
- `new_ms_id` / `update_ms_id` — 新/更新機體標記（映射到 `New/Update/Non` 標籤）
- `mastery` — 熟練度等級（映射到 `Mastery01`-`Mastery21` 標籤）

**結論：要在 preview 中完全復現 machineselect，需要模擬 C++ Controller 層的數據注入行為。**

### 遊戲數據提取管道（vs2 版本）

**數據源:** `E:\XB\解包\vs2\x64\` — 已解壓的遊戲數據
**格式:** `.vgsht2` — magic `A9B8ABCD`，同 OB 版本基礎格式（每項 ID 數組 + 數據數組）
**字符串加密:** 基於 `index%14` 的按字節變換（與 OB 共用 `obfTransformByte` 算法）

#### 已提取數據

| 來源文件 | 記錄數 | 提取數據 |
|----------|--------|----------|
| `012list/character_list/character_list.vgsht2` (133KB) | 195 | 角色名、系列 ID、各種 LMB 哈希、狀態 |
| `041cpm/for_outgame/foroutgamecharacterparam_playable.vgsht2` (3.1KB) | 253 | **Cost + HP**（每角色 8 字節） |
| `012list/mastery_list/mastery_list.vgsht2` | 22 | 熟練度等級（Lv0-21，0→6000 pts） |
| `012list/skill_list/skill_list.vgsht2` | 33 | 技能數據 |
| `100system/awakening_param/awakening_param.vgsht2` | 6 | **覺醒/Burst 參數** |
| `012list/pilot_list/pilot_list.vgsht2` | 180 | 駕駛員數據 |
| `012list/series_list/series_list.vgsht2` | 56 | 作品系列列表 |

**Cost 分布:** 1500×23, 2000×63, 2500×66, 3000×43（合計 195）

#### 文件位置
- `gamedata/vs2_gamedata.json` — 完整原始數據（含全部字段）
- `preview/public/gamedata/ms_data.json` — 精簡版（供 preview 工具使用）
- `extract_gamedata.cjs` — 提取腳本

### DevFixture 地圖
現在可用的 devFixture URL：
- `?devFixture=lm_menu` — 主菜單（交互式，48 紋理，74 實例）
- `?devFixture=staffroll` — 制作人員名單（動畫，91 紋理，231 實例）
- `?devFixture=machineselect` — 機體選擇（交互式，187 紋理，797 實例）

---

## 2026-04-23（lm_menu 遊戲控制 + UI/UX 改進）

### IDA Pro 逆向分析成果
- **引擎確認:** 遊戲使用 **Lumen** 引擎（非標準 Flash），RTTI 字符串包含 `lumen::Object`, `lumen::as20::Matrix`, `lumen::Base` 等
- **LMB 解析器結構:** 確認 `TopLevelParser`, `ContentParser`, `DefinesParser`, `SpriteChildParser`, `PlaceObjectChildParser`, `ShapeChildParser`, `TextChildParser`, `ButtonChildParser`
- **LM_MENU 標籤系統:**
  - **MAIN 菜單:** `LM_MENU_MAIN_RANKING`, `LM_MENU_MAIN_EVENTCUP`, `LM_MENU_MAIN_INFO`, `LM_MENU_MAIN_REPLAY`, `LM_MENU_MAIN_BANAP`, `LM_MENU_MAIN_GROUPMAINLM`
  - **每個 MAIN 項都有 `_FOCUS` 對應項**（如 `LM_MENU_MAIN_RANKING_FOCUS`）
  - **SUB 菜單:** `SPOTINFO`, `OFFICIALINFO`, `MOBILEINFO`, `MOVIE1/2`, `SETTING`, `REPLAY_*`, `BANAP`, `ACCESSCODE`, `EVENT_INFO`, 多種 `RANKING_*`
  - **特殊:** `LM_MENU_TITLE_TOP`
- **顯示對象路徑:** `/display_object_mc/icon_mc/net_mc`, `/display_object_mc/Credit_Dt_mc`, `/display_object_mc/Telop_Dt_mc/dt_telop`

### lm_menu 結構分析
- **解析度:** 1920×1080 @ 60fps
- **根 Sprite:** 112（1 幀容器）
- **關鍵 Sprites:**
  - **Sprite 111** (83 frames): 主菜單動畫 — Start, Wait, Live_Open/Wait/Close, View_Open/Wait/Close, End
  - **Sprite 107** (54 frames): Start, Wait, END
  - **Sprite 80** (28 frames): menu, Cancel, OK, Play_a/b, Ranking_a/b, Select, View_*, Unnei_*, GroupPlay_*
  - **Sprite 23** (11 frames): Player_A_1/2, Player_B_1/2, Team_A/B, Dynamic_*, Bird
  - **Sprite 91** (3 frames): A, B, C
  - **Sprite 97** (5 frames): text, text_black, BANAPASS, BANAPASS_Black, non
  - **Sprite 106** (2 frames): on, non
- **資源:** 48 按鈕, 48 紋理圖集, 3 文字定義, 137 符號
- **紋理載入:** devFixture 使用 `lmb_texture_binding.json` 的 byAtlasId 映射，全部 img-00000..img-00047.png

### 新功能實現

#### GameControlPanel（遊戲控制面板）
- **鍵盤控制:** ↑↓←→（WASD）導航 | Enter/Space 確認 | Esc/Backspace 取消
- **虛擬方向鍵:** 可視化 D-pad 按鈕
- **標籤分組:** 自動將標籤分為 Main Menu / Sub Menu / Animation 三組
- **FOCUS 狀態:** 標記具有 `_FOCUS` 對應項的標籤，導航時自動觸發
- **Action Log:** 實時顯示最近 20 條操作記錄
- **Sprite 選擇器:** 可切換控制目標 Sprite（只顯示有標籤的 Sprite）

#### Stage 改進
- **3 種縮放模式:** Fit（適應窗口）/ 1:1（原始大小）/ Fill（填滿窗口）
- **Zoom 控件:** 放大/縮小按鈕 + 百分比顯示 + 重置按鈕
- **ResizeObserver:** 自動響應容器大小變化
- **載入提示:** 未載入時顯示歡迎信息和快捷鍵提示

#### App 佈局改進
- **Inspector 可折疊:** 標題欄添加了折疊/展開按鈕
- **自動播放:** 載入 LMB 後自動開始循環播放
- **GameControlPanel 集成:** 在 Stage 下方顯示遊戲控制面板

### 瀏覽器測試結果
- lm_menu devFixture 載入成功：74 個顯示實例正確渲染
- LIVE 標題、黃色菜單項、選択/決定/キャンセル 底部按鈕均正確顯示
- 鍵盤控制已通過測試：↓ 導航 + Enter 確認 正常工作
- Action Log 正確記錄所有操作

---

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
