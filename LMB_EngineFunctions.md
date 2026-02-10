## Purpose

本文档基于 IDA Pro（通过 `idapro-mcp`）对游戏可执行文件的反编译结果，总结当前**已确认**的、与 **LMB（Lumen Movie Binary，tag-based 类 SWF）** 的：

- **读取 / 解压 / 校验**（文件系统、I/O、Deflate）
- **解析 / 构建运行时对象**
- **按帧解析 tag 并执行**（display list、keyframe rebuild、do_action 等）

相关的函数、地址、参数、行为与推断依据。

> 说明
>
> - 本文尽量使用“证据驱动”的描述：每个推断都给出来自反编译代码的直接迹象（常量、字段偏移、分支结构、调用链）。
> - 对仍不确定的结构字段，会明确标注为 **推断**，避免把猜测当事实。
> - 文内会使用你 repo 的 `lmb.ksy` 作为“格式对照基准”，用来解释为何引擎侧行为与 `data_len * 4`、tag children 计数等完全一致。

---

## LMB 格式要点（用于理解引擎侧执行逻辑）

来自 `lmb.ksy` 的核心规则（引擎侧代码直接体现了这些规则）：

- **Tag 头部**：`tag_type(u2) + offset(u2=0) + data_len(u4)`
- **Tag 数据长度单位**：`data_len` 的单位是 4 bytes，tag 总步进长度为：

```text
tag_total_bytes = (data_len * 4) + 8
```

- **End sentinel**：`0xFF00`（`65280`）在引擎侧被当作“结束/占位”的特殊 tagType。
- **children**：部分 tag（如 `define_sprite`、`frame/show_frame/keyframe`、`place_object`）会携带 `num_children`，children 紧随其后线性排列。

这些规则决定了：引擎在运行时可以“顺序扫描 tag 流”并通过 `(data_len*4 + 8)` 快速跳到下一个 tag，而不需要复杂的随机访问。

---

## 总体数据流（从磁盘到每帧执行）

以“最贴近游戏真实行为”的层次描述整体链路：

1) **文件路径解析 / 打开 / 读取（nu::FileSystem_x64 / nu::File_x64）**
2) **容器或资源包解压（nu::Deflate::Decompress + CRC 校验）**
3) **Lumen 内容加载（loader / parser）**
4) **LMB runtime 结构：definition tables + sprite timelines + display list**
5) **播放**
   - `tick()`：推进一帧（只 apply 当前帧）
   - `goto(frame)`：跳帧（使用 keyframe 作为锚点 rebuild）

在 IDA 中已明确的“执行核心”位于 `lumen::Sprite` 及其辅助函数中（下文详述）。

---

## 低层：文件系统、文件 I/O、解压

### `nu::FileSystem_x64::Mount`

- **地址**：`0x140056E20`
- **符号**：`?Mount@FileSystem_x64@nu@@SA?AVResult@2@PEBD0@Z`
- **作用**：将逻辑路径/卷标挂载到实际文件系统路径。
- **与 LMB 的关系**：LMB（以及容器 LMD/XMD）通常通过资源系统虚拟路径访问，必须先 mount 才能解析出正确绝对路径。

---

### `nu::FileSystem_x64::GetAbsolutePath`

- **地址**：`0x140056EB0`
- **符号**：`?GetAbsolutePath@FileSystem_x64@nu@@SA?AVResult@2@AEAV?$FixedString@$0CAA@D@2@AEBV42@@Z`
- **作用**：逻辑路径 → 绝对路径。
- **证据**：在 `nu::File_x64::Exists`、`FileBase::Open` 等函数中存在对它的直接调用交叉引用。

---

### `nu::File_x64::Exists`

- **地址**：`0x14005C2B0`
- **符号**：`?Exists@File_x64@nu@@SA_NPEBD@Z`
- **作用**：检查逻辑文件路径对应的文件是否存在。
- **与 LMB 的关系**：典型用途是资源回退/分支加载。

---

### `nu::File_x64::OpenAbsolutePath`

- **地址**：`0x14005BCE0`
- **符号**：`?OpenAbsolutePath@File_x64@nu@@UEAA?AVResult@2@PEBDAEBUDesc@FileBase@2@@Z`
- **作用**：Windows 平台最终通过 `CreateFileA` 打开文件句柄。
- **与 LMB 的关系**：当资源系统算出绝对路径后，真正对磁盘进行打开就是它。

---

### `nu::File_x64::Read`

- **地址**：`0x14005BF60`
- **符号**：`?Read@File_x64@nu@@QEAA_KPEAX_K@Z`
- **作用**：循环 `ReadFile` 直到满足请求字节数或失败。
- **关键行为（反编译摘录）**：
  - 若文件未打开：直接返回 0
  - 每次读取最大 `0xFFFFFFFF`（32-bit 上限）
  - 任意一次 `ReadFile` 失败返回 0

该函数是“从文件读取 LMB/LMD/XMD 原始字节”的基础设施。

---

### `nu::Deflate::Decompress`

- **地址**：`0x1402753D0`
- **符号**：`?Decompress@Deflate@nu@@SA?AVResult@2@PEAXI0IAEAI@Z`
- **作用**：对 deflate/zlib 压缩数据进行解压。
- **关键证据**：
  - 初始化时出现 `"1.2.8"` 字符串：表明使用 zlib 1.2.8 兼容实现
  - 解压结果大小写回 `*a6`

---

### 容器/资源包解压与校验（两条已确认调用链）

#### `sub_1405AC700`

- **地址**：`0x1405AC700`
- **作用**：解压一块带 CRC 的容器数据到内存，并进行 CRC 校验，然后把解压后的内容喂给后续解析。
- **关键行为（证据点）**：
  - 先分配大块内存（保存到 `a1 + 292352`）
  - 调用 `nu::Deflate::Decompress(...)`
  - 对解压结果进行 CRC（对 `v14 + 2` 开始、`v26 - 16` 字节）
  - CRC 不匹配会清理并返回失败

#### `sub_14075C570`

- **地址**：`0x14075C570`
- **作用**：验证容器头（magic/版本等）、CRC 校验后解压到一个可增长 buffer（目标容量上限类似 `0x4000000`），并写入终止 0 字节。
- **关键证据**：
  - 检查 `*(_WORD *)(a2 + 12) != 905`（容器类型/版本号）
  - `a3 - 16` 与 header 中长度字段一致
  - CRC 覆盖 `a2 + 16` 起、`a3 - 16` 字节
  - 调用 `nu::Deflate::Decompress` 解压主体

> 说明：以上两条链路说明 LMB 在游戏中往往不是“裸 `.lmb` 文件”，而是被封装/压缩后由资源系统加载。你 repo 里 `LMB分析.md` 的 I/O 与 deflate 推断在这里得到强证据支持。

---

## 高层：Lumen/LMB runtime 的“解析、构建、播放、执行”

### 核心对象：`lumen::Sprite`

在 IDA 中可以确认 `lumen::Sprite` 是 LMB 的主要 runtime 执行体（类似 Flash 的 MovieClip/Sprite），包含：

- 指向 definition / timeline 数据的指针（可从 `a1 + 304` 等字段看到）
- 当前帧索引（`a1 + 488`）
- 总帧数（`a1 + 492`）
- display list（位于 `a1 + 312` 相关结构上，通过 `depth` 索引）
- 资源表引用（transforms/positions/colors/bounds 等在对象属性应用阶段被索引）

下面按“播放控制 → 逐帧执行 → 关键 tag 处理 → 实例化/对象类型判定 → keyframe rebuild”的顺序，逐个记录已确认函数。

---

## 播放控制（tick / goto）

### `sub_140222740` —— `lumen::Sprite::Tick`（逐帧推进）

- **地址**：`0x140222740`
- **返回**：`void`
- **核心职责**：把当前帧索引 `currentFrame` 前进一帧，并对该帧执行 tag。
- **关键字段（已确认）**：
  - `currentFrame`：`*(u32*)(a1 + 488)`
  - `numFrames`：`*(u32*)(a1 + 492)`
  - `timelinePtr`：`*(qword*)(a1 + 304)`（存在性检查决定是否能播放）
- **反编译行为要点**：
  - 若 `a1 + 304` 为空：不做任何事情（说明 sprite 尚未绑定 timeline/资源）
  - `++currentFrame`
  - 若 `currentFrame >= numFrames`：
    - 若 `numFrames == 1`：退回一帧（保持在 0 或最后一帧）
    - 否则：
      - `currentFrame = 0`
      - 清空 display list（见 `sub_140229120 / sub_140229270` 的调用点）
      - 执行第 0 帧：`sub_140223A90(a1, 0, 0, 0)`
  - 否则：只执行新增的一帧：`sub_140223A90(a1, currentFrame, currentFrame, 0)`

#### 重要结论（对 preview/runtime 的直接影响）

Tick 只 apply 当前帧，这意味着 **display list 状态是跨帧累积的**。因此任何 preview 若用“每帧全量重建”而不保持 display list，会与游戏行为不一致（尤其在 MOVE、REMOVE、以及 keyframe rebuild 时差异很明显）。

---

### `sub_1402222F0` —— `lumen::Sprite::GotoFrame`（跳帧/seek + deterministic rebuild）

- **地址**：`0x1402222F0`
- **参数**：`(a1: Sprite*, a2: int targetFrame1BasedOr0BasedLike)`
- **返回**：`void`
- **核心职责**：跳转到目标帧，并保证 display list 状态与“从正确锚点重放到该帧”一致。

#### 关键观察：keyframe-based rebuild（强证据）

该函数会根据 targetFrame 与 currentFrame 的关系决定：

- **如果目标在当前之前**（或需要回退重建）：
  - 清空 display list（`sub_140229120(a1 + 312)`）
  - 查找最近 keyframe：`sub_140224C70(a1, targetFrame)`
  - 先应用 keyframe（一次性把关键状态重建出来）：`sub_140224CB0(a1, keyframePtr, targetFrame)`
  - 再从 keyframe 的下一帧 apply 到 target：`sub_140223A90(a1, startFrame, targetFrame, a4=...)`
  - 最后提交 display list（`sub_140229270(a1 + 312)`）

- **如果目标在当前之后**：
  - 可能只 apply 中间增量，或按另一路径做局部 rebuild（同样会调用 `sub_140224C70 / sub_140224CB0 / sub_140223A90` 的组合）

#### 伪代码（English）

```text
gotoFrame(target):
  if not sprite.timeline: return
  target = clamp(target, 0, numFrames-1)
  if target < currentFrame:
    clearDisplayList()
    kf = findKeyframeAtOrBefore(target)
    if kf:
      applyKeyframe(kf, target)
      start = min(kf.frameIndex + 1, target)
    else:
      start = 0
    applyFrames(start, target, skipSideEffects=false)
    commitDisplayList()
  else:
    # forward seek path (may still use keyframe when needed)
    applyFrames(currentFrame+1, target, skipSideEffects=false)
  currentFrame = target
```

> 注：上面伪代码是对 `sub_1402222F0` 的行为抽象，不代表精确的局部变量命名，但“clear → keyframe → apply range → commit”的结构在反编译中非常清晰。

---

## 逐帧执行核心：扫描 frame children 并按 tagType 分派

### `sub_140223A90` —— `lumen::Sprite::ApplyFramesRange`

- **地址**：`0x140223A90`
- **参数**：`(a1: Sprite*, a2: startFrame, a3: endFrame, a4: bool skipOrLimitedExecution)`
- **返回**：`unsigned __int64`（内部作为计数/索引使用）

#### 该函数在做什么（宏观）

对 frameIndex 从 `a2` 到 `a3`：

1) 拿到每帧的 tag block 指针（frame 对应的 children 流）
2) 按 `tag_total_bytes = data_len*4 + 8` 顺序扫描
3) 对关键 tag 做分派执行：
   - `place_object`：构建/更新 display object，并插入 display list（按 depth）
   - `remove_object`：从 display list 移除 depth
   - `do_action`：在一定条件下触发脚本/事件
   - 其它 tag：多数被跳过或只在特定时机执行

#### 关键证据：`data_len * 4 + 8` 的步进公式

在函数中存在以下等价逻辑（来自反编译变量）：

- `v11 = 4LL * tag[1] + 8;`
- `v8 += v11;`
- `tagType = *(u32*)((u8*)tag + v8);`

这与 `lmb.ksy` 中 `data_len * 4` 完全一致，并且明确了：引擎扫描的是 **包含 8 bytes 头部的 tag 流**。

#### `0xFF00 (65280)` 的意义（End sentinel）

当 `tagType == 65280` 时，函数走特殊分支跳过某些读取，表现为“保持 sentinel 并继续处理 children 数量/跳过逻辑”。

这对应 `lmb.ksy` 的 `0xff00: end`。

#### tagType 分派（已在该函数内直接看到的分支）

以下 tagType 与行为已可从反编译清晰归纳（括号内为 `lmb.ksy` 的枚举名）：

- **4**（`place_object`）
  - 调用：`sub_140223DC0(a1, placeTagPtr, childCount, childPtr)`
  - 这是 display list 构建的核心入口

- **5**（`remove_object`）
  - 调用：`sub_140228F60(a1 + 312, depth)`
  - depth 来自 remove_object tag 的字段（见后文）

- **12**（`do_action`）
  - 在 `sub_140223A90` 与 `sub_140224CB0` 都能看到对 `tagType == 12` 的专门处理
  - 调用点会走 `sub_140227730 / sub_1402272C0 / sub_1402274A0 / sub_1402273B0` 等“动作执行/事件派发”路径（地址已记录，但具体语义仍需要进一步展开）

- **15**（推断：与 frame 末尾/提交点相关）
  - 在 `sub_140223A90` 中存在针对 `tagType == 15` 的大分支，尤其在 `frame == endFrame` 的情况下会触发回调/派发
  - 由于 `lmb.ksy` 并未定义 15，这很可能是“引擎内部扩展 tag”或某种“frame boundary marker”。
  - 当前结论：**它是影响 do_action 执行时机与提交点的重要 tag**，但具体字段意义需要继续对照更多样本。

- **66 / 78**
  - `sub_140223A90` 明确把这两类 tag 当作“特殊但不执行 place/remove/action 的类型”，会调整扫描指针后继续。
  - 当前结论：**它们是 frame children 流中的一种可跳过块**，可能是某些扩展信息块或资源绑定块。

> 对 preview 的建议：不要在 JSON runtime 里把 `do_action` 设计成“见到就执行”。从引擎逻辑看，do_action 的触发被绑定在“提交点/特定分支”，而不是线性扫描时的无条件执行。

---

## 常见 tag 的二进制布局速查（与 `lmb.ksy` 对照）

以下布局以“tag 起始地址”（含 8 bytes tag header）为基准，便于你在 IDA/Hex 里直接对齐字段。

### `frame` / `keyframe` / `show_frame`（tagType = 0xF105 / 0x0001）

| Offset | Size | Field | Notes |
|---:|---:|---|---|
| +0 | 2 | `tag_type` | `keyframe`/`show_frame` |
| +2 | 2 | `offset` | 0 |
| +4 | 4 | `data_len` | unit: 4 bytes |
| +8 | 4 | `id` | ksy: `frame.id` |
| +12 | 4 | `num_children` | children tags immediately follow |

### `remove_object`（tagType = 0x0005）

| Offset | Size | Field | Notes |
|---:|---:|---|---|
| +0 | 2 | `tag_type` | 0x0005 |
| +2 | 2 | `offset` | 0 |
| +4 | 4 | `data_len` | unit: 4 bytes |
| +8 | 4 | `unknown1` | ksy: `u4` |
| +12 | 2 | `depth` | display list key |
| +14 | 2 | `unknown2` | ksy: `u2` |

> 说明：当前我们已确认引擎会把 remove_object 的某个 `u16` 字段当作 depth 并调用 `sub_140228F60(displayList, depth)`。该表的字段位置来自 `lmb.ksy`，与引擎其它 tag 的“header+data”偏移规律一致。

### `do_action`（tagType = 0x000C）

| Offset | Size | Field | Notes |
|---:|---:|---|---|
| +0 | 2 | `tag_type` | 0x000C |
| +2 | 2 | `offset` | 0 |
| +4 | 4 | `data_len` | unit: 4 bytes |
| +8 | 4 | `action_id` | ksy: `do_action.action_id` |
| +12 | 4 | `unknown` | ksy: `do_action.unknown` |

## display list 操作（depth 为 key）

### `sub_140228F60` —— RemoveObject（按 depth 移除实例）

- **地址**：`0x140228F60`
- **参数**：`(a1: DisplayListLike*, a2: depth)`
- **核心行为**：
  - 取出 `displayList[depth]` 对应的对象句柄
  - 调用对象的虚函数（偏移 `+160`）做 detach/cleanup
  - 清空槽位并释放引用计数

这与 SWF 的 `RemoveObject` 行为一致：删除指定 depth 的显示对象。

---

### `sub_140223DC0` —— PlaceObject（place/move，含可选 children）

- **地址**：`0x140223DC0`
- **参数**：
  - `a1`: `Sprite*`
  - `a2`: `place_object tag 指针`
  - `a3`: `该 place_object tag 的 children 数量`（推断：来自 place_object 的 `has_color_matrix + has_unknown_f014`）
  - `a4`: `children 起始指针`（紧随其后的 tag 流）

#### 与 `lmb.ksy::place_object` 字段对照（关键偏移）

`lmb.ksy` 定义了：

- `placement_mode(u2)`：`place=1, move=2`
- `blend_mode(u2)`
- `depth(u2)`
- `position_id(s2)` + `position_flags(u2)`
- `color_mult_id(s4)` / `color_add_id(s4)`
- `has_color_matrix(u4)` / `has_unknown_f014(u4)`（两者之和为 children 数）

在引擎侧 `sub_140223DC0` 可以直接看到：

- `placement_mode` 被读取并做 `-1` 变换：
  - `v10 = *(u16*)(a2 + 24) - 1`
  - 这意味着：
    - `*(u16*)(a2+24)==1` → `place`
    - `*(u16*)(a2+24)==2` → `move`
- `depth`：`*(u16*)(a2 + 28)`（作为 display list 索引）
- `blend_mode`：`*(u16*)(a2 + 26)`（非 0 时写入 instance 的 blend 字段）

#### `place_object` 二进制布局速查（以引擎传入指针为基准）

为了便于你做 preview/runtime 的“字段精确对齐”，这里给出一个**按字节偏移**的速查表。该表与 `lmb.ksy::place_object` 一致，唯一需要注意的是：引擎侧很多函数拿到的 `placeTagPtr` 是 **tag 头（8 bytes）起始地址**，因此字段偏移是从 tag 起始算的：

| Offset (bytes) | Size | Field (ksy) | Notes |
|---:|---:|---|---|
| +0  | 2 | `tag_type` | e.g. `0x0004` |
| +2  | 2 | `offset` | observed 固定为 0 |
| +4  | 4 | `data_len` | unit: 4 bytes |
| +8  | 4 | `character_id` | `s4` in ksy |
| +12 | 4 | `placement_id` | `s4` |
| +16 | 4 | `unknown1` | `u4` |
| +20 | 4 | `name_id` | `u4` |
| +24 | 2 | `placement_mode` | `u2` enum: place/move |
| +26 | 2 | `blend_mode` | `u2` enum |
| +28 | 2 | `depth` | `u2` (display list key) |
| +30 | 2 | `unknown2` | `u2` |
| +32 | 2 | `unknown3` | `u2` |
| +34 | 2 | `unknown4` | `u2` |
| +36 | 2 | `position_id` | `s2` |
| +38 | 2 | `position_flags` | `u2` enum: transform/position/no_transform |
| +40 | 4 | `color_mult_id` | `s4` |
| +44 | 4 | `color_add_id` | `s4` |
| +48 | 4 | `has_color_matrix` | `u4` (0/1) |
| +52 | 4 | `has_unknown_f014` | `u4` (0/1) |
| +56 | ... | `children[]` | count = `has_color_matrix + has_unknown_f014` |

> 备注：在 `sub_140224270` 里对 `*(u16*)(+28/+30)` 做了 `-0x3FFF` 的去 bias 处理，这是“构造/初始化路径”里观察到的现象；但在 `sub_140223DC0` 里它会把 `*(u16*)(+28)` 直接当作 depth key 使用。两者是否是同一字段、还是 `sub_140228BF0/sub_140228A20` 内部做了统一转换，目前仍需要进一步确认，因此本文对 `-0x3FFF` 的语义保持保守描述。

#### place vs move 的行为差异（基于反编译分支结构）

该函数把 `placement_mode` 做 `-1` 后分三类：

- **place（placement_mode == 1）**
  - 会先尝试在 `depth` 上获取已存在的实例
  - 若存在且其“定义/character”匹配：**复用实例**并仅更新属性（避免 delete + new）
  - 若存在但不匹配：会先 remove 再创建新实例

- **move（placement_mode == 2）**
  - 会优先取出 depth 上已存在实例作为“基底”
  - 之后会创建/获取目标实例并进行“状态延续 + 覆盖更新”
  - 从反编译可见：它会把一段字段（颜色/矩阵/指针等）从旧实例 copy 到新实例，再应用本次 place_object 的资源引用

- **其它值**
  - 在 `v10 != 0 && v10 != 1` 的分支会走“通用路径”：先 remove depth，再创建新实例并应用属性

> 对 preview 的关键影响：如果你把 move 当成“完全等价 place”，会导致跨帧累积状态（尤其 color/transform/children）的行为与游戏不一致。

---

## `place_object` children：`has_color_matrix` 与 `has_unknown_f014` 的真实用途

在 `sub_140223A90` 的 `tagType == 4 (place_object)` 分支中，可以明确看到它读取两个 `u32` 并用它们来“跳过随后跟随的 child tags”，并把 child 起始指针传给 `sub_140223DC0`：

- `childCount0 = *(u32*)(placeTag + 48)`（等价于 `lmb.ksy::has_color_matrix`）
- `childCount1 = *(u32*)(placeTag + 52)`（等价于 `lmb.ksy::has_unknown_f014`）
- `childrenPtr = placeTag + 56`（紧随 place_object 固定数据后的第一个 child tag）

这与 `lmb.ksy` 的：

- `has_color_matrix(u4)`
- `has_unknown_f014(u4)`
- `children = has_color_matrix + has_unknown_f014`

完全吻合。

当前可确认结论：

- 引擎以这两个字段作为“children 数量”的来源（至少在执行层面如此使用）
- children 的具体 tagType（例如 `0xF037 color_matrix`、`0xF014 play_sound` 等）需要进一步对照样本，但 children 的线性布局方式是确定的

---

## 实例化与对象类型判定（characterId → Shape/Sprite/Text…）

### `sub_140224270` —— Instantiate / Fetch DisplayObject for PlaceObject

- **地址**：`0x140224270`
- **签名（IDA 反编译）**：`__int64 *__fastcall sub_140224270(_QWORD *a1, __int64 *a2, __int64 a3, unsigned int a4, nu *a5)`
- **调用者**：`sub_140223DC0`
- **核心职责**：
  - 根据 `place_object` 的 `character_id`（以及其在定义表中的类型码）创建对应的 display object（`lumen::Sprite` / `lumen::DynamicText` / `lumen::Shape` 等）
  - 把该对象插入“按 depth 索引的 display list 槽位”
  - 处理必要的资源绑定（例如材质/图形数据引用）

#### 输入关键字段（place_object 内）

该函数在开头直接读取：

- `character_id`：`*(u32*)(a3 + 8)`
- `placement_id`：`*(u32*)(a3 + 12)`

这与 `lmb.ksy::place_object` 的字段顺序一致（注意：这里的偏移包含了 8-byte tag header，因此是 `+8/+12`）。

#### “两个 u16 减去 0x3FFF”的现象（重要观察，语义待确认）

函数中存在：

- `v18 = *(u16*)(a3 + 28) - 0x3FFF`
- `v52 = *(u16*)(a3 + 30) - 0x3FFF`

这表明 place_object 的两段 `u16` 字段在进入构造函数/初始化逻辑前做了“去 bias”处理。

- **证据强度**：高（代码直接存在减法）
- **语义确定性**：中（尚未完整还原这两字段对应 `lmb.ksy` 的哪个概念；在 `lmb.ksy` 里它们落在 `depth/unknown2` 区间）

当前建议把它们在工具层保留为原始字段，并在 runtime 层允许两种解读：

- raw u16（不做 bias）
- signed-like value = raw - 0x3FFF（与引擎构造路径一致）

#### 对象类型判定（definition type code）

该函数会从某个“definition/type table”中取出一个 `u16` 类型码 `v20` 并 switch：

- `v20 == 39 (0x27)`：创建 `lumen::Sprite`
  - 证据：调用 `sub_140221260(...)` 并写入 `lumen::Sprite::\`vftable'`
  - 与 `lmb.ksy` 的 `define_sprite (0x0027)` 一致

- `v20 == 37 (0x25)`：创建 `DynamicText`（推断为 `lumen::DynamicText`）
  - 证据：进入 `case 37` 分支，调用 `sub_14021E070(...)`（文本对象构造）
  - 与 `lmb.ksy` 的 `dynamic_text (0x0025)` 一致

- `v20 == 11` / `v20 == 7`：创建其它对象（未完全命名）
  - 证据：存在独立 `case 11`、`case 7` 分支，分别调用不同构造函数（`sub_14021DCF0`、`sub_14021FB80`）
  - 当前结论：对应某些“非 sprite/非文本”的定义类型（可能是 button/graphic/shape 的某种变体），需后续对照更多样本与 RTTI 命名进一步确认

- default：
  - 若不是 `39`，会走创建 `lumen::Shape` 的路径（反编译中能看到 `lumen::Shape::\`vftable'`）

#### 结果写回与缓存

该函数不仅返回新对象，还会把对象写入：

- 一个“按 depth 的对象槽位数组”（从 `sub_140223DC0` 的 `sub_140228F60(a1+312, depth)` 与本函数的 `sub_140228A20`/`sub_1402288D0` 等调用点可以推断它是 display list 的核心容器）
- 一个“按 characterId/资源表索引的缓存表”（多处出现 `*(qword*)(tableBase + 8 * someId) = objectPtr` 以及引用计数调整）

---

## `lumen::Sprite` 构造、析构与初始绑定

### `sub_140221260` —— `lumen::Sprite` constructor-like initializer

- **地址**：`0x140221260`
- **核心行为**：
  - 先调用基类初始化：`sub_14021BCC0(...)`
  - 写 vtable：`*(_QWORD *)a1 = &lumen::Sprite::\`vftable'`
  - 绑定 timeline/definition 指针：`*(qword*)(a1 + 304) = a5`
  - 初始化 display list 容器：`sub_1402281A0(a1 + 312, *a2, v13)`
  - 初始化多项运行时字段：
    - `currentFrame`、`numFrames` 等在后续由 `sub_140221440`/加载逻辑写入
    - 创建一段固定大小的 vector/array（`eh vector constructor iterator`）

这说明：Sprite 的 display list 是构造阶段就创建的，播放阶段只做增量更新。

---

### `sub_1402213C0` —— `lumen::Sprite` destructor

- **地址**：`0x1402213C0`
- **核心行为**：
  - 调用 `eh vector destructor iterator` 销毁内部数组
  - `sub_140228340(a1 + 312)` 清理 display list 容器
  - `sub_14021BEB0(this)` 清理基类

---

### `sub_140221440` —— Sprite post-init / enter playable state

- **地址**：`0x140221440`
- **核心行为（已确认）**：
  - 若绑定了 timeline/definition（`a1 + 304` 非空）：
    - 写入 `numFrames`：`*(u32*)(a1 + 492) = *(u32*)(*(qword*)timeline + 24)`（从反编译可见它从 definition 取一个帧数）
    - 若存在某些条件（例如 `a1 + 64` 不为空）：
      - 调用 `sub_140224B40(a1, 1)`（触发某类 action/事件）
      - 若 `a1 + 512` 非空：通过 `sub_140227590(...)` 注册/提交某种对象
      - 最终调用 `sub_140223A90(a1, 0, 0, 0)` 执行第 0 帧
    - 若某个条件不满足，会把 `currentFrame` 设为 `-1`（反编译里可见 `*(u32*)(a1 + 488) = -1`）
  - 若 timeline 为空：设置某些“未就绪”标志位

该函数是“sprite 从资源加载完毕 → 可以开始播放”的关键过渡点。

---

## keyframe rebuild：为什么跳帧必须从最近 keyframe 重建

### `sub_140224C70` —— Find keyframe at/before target

- **地址**：`0x140224C70`
- **输入**：`(a1: Sprite*, a2: targetFrame)`
- **输出**：指向某个 keyframe 结构的指针（可能为空）
- **行为要点**：
  - 遍历 `timeline->keyframeIndexArray`（推断：`v2[3]` 指向一个按 frameIndex 排序的表）
  - 找到最后一个 `keyframe.frameIndex <= targetFrame` 的记录并返回

### `sub_140224CB0` —— Apply keyframe and then apply child placements

- **地址**：`0x140224CB0`
- **核心职责**：
  - 把 keyframe 对应的“基准 display list 状态”重建出来（包括必要的 do_action/资源更新）
  - 然后对 keyframe 内的 placement 列表进行遍历，并对每个 placement 调用 `sub_140223DC0`（place/move）以建立可用于后续增量 apply 的状态

该函数与 `sub_1402222F0` 一起，构成“seek 时 deterministic rebuild”的完整闭环。

---

## 属性应用（transform / color 等资源引用）

### `sub_140223A10` —— Apply initial transform/color references for a new instance

- **地址**：`0x140223A10`
- **输入**：`(a1: DisplayObject*, a2: place_object tag data ptr)`
- **行为要点**：
  - 读取 `a2[10]`、`a2[11]` 等字段作为资源表索引（从 `a1+48` 指向的资源表中取对象指针）
  - 设置到 instance 的字段：
    - `*(qword*)(a1 + 160)`、`*(qword*)(a1 + 168)`（推断：color mult/add 指针）
    - 标记 `*(u8*)(a1 + 297) = 1`（推断：hasColor）
  - 若存在矩阵/位置引用：调用 `sub_14021BB90(a1 + 112, *(qword*)(a1 + 48))` 并置 `*(u8*)(a1 + 296) = 1`

### `sub_1402241A0` —— Apply property update on existing instance

- **地址**：`0x1402241A0`
- **调用者**：`sub_140223A90`（在某些 tagType 的分支里）
- **核心行为**：与 `sub_140223A10` 类似，但它会先通过 depth 查到现有 instance，再对其更新颜色/矩阵引用。

> 对 preview 的建议：把“属性引用应用”做成独立模块（类似你 `ResourceStore` 的 `resolveTransform/resolveColor`），并且区分“新建实例初始化”和“已存在实例的属性更新”两种路径。

---

## do_action 执行（当前已确认到“触发点”，未完全还原 bytecode 语义）

在 `sub_140223A90` 与 `sub_140224CB0` 中，`tagType == 12` 会触发到一组函数（地址在反编译里可见调用）：

- `sub_140227730`
- `sub_1402272C0`
- `sub_1402274A0`
- `sub_1402273B0`

从调用参数形态看，它们接受：

- 上下文指针（与 `a1 + 40`、`a1 + 48`、`a1 + 64` 等相关）
- 某个 actionId（推断来自 `do_action.action_id`）
- 以及一个 `sub_1401CFFC0(a1, ...)` 生成的“执行环境/上下文 token”

当前可以确定的结论：

- do_action 并非“线性扫描一律执行”，其触发与 `tagType == 15`（提交点）以及 “是否是 endFrame / 是否是 seek rebuild” 强相关
- preview 若要提升一致性，应该先对齐“触发时机”，再逐步扩展 action 语义

---

## 附：如何在 IDA 中定位这些函数（本次使用的方法）

由于二进制中未必包含明文 `"LMB\\0"` 或 `.lmb` 字符串，本次定位执行核心采用了“从运行时类型（RTTI）与 vtable 反推”的策略：

1) 通过字符串列表发现 `.?AVSprite@lumen@@` 等 RTTI Type Descriptor 名称
2) 由 Type Descriptor 回推 Complete Object Locator（COL）与 vtable 指针
3) 从 `lumen::Sprite` vtable 的引用与交叉引用定位构造/析构/播放相关函数
4) 再沿着调用链找到 `ApplyFramesRange`、`PlaceObject`、`Instantiate` 等核心函数

这套方法对于没有显式格式 magic 的资源解析系统尤其有效。

---

## 附：本次分析中出现但尚未深挖的辅助函数索引（便于你继续追）

下面这些函数在核心链路中频繁出现，我们已能从调用位置推断其“职责大类”，但还未逐个做完整结构还原。为了满足“每个对应函数是什么”的记录需求，这里先给出索引级别说明（后续你如果需要，我可以继续把它们逐个反编译展开）。

| Function | Likely role | Evidence (where it is called) |
|---|---|---|
| `sub_140229120` | Begin/clear display list transaction | Called before rebuild/apply in `sub_1402222F0` / `sub_140222740` |
| `sub_140229270` | Commit/end display list transaction | Called after apply in `sub_1402222F0` / `sub_140222740` |
| `sub_140228BF0` | Lookup instance by depth | Used from `sub_140223DC0`/`sub_1402241A0` before property updates |
| `sub_140228A20` | Set instance into depth slot | Used from `sub_140224270` when inserting created object |
| `sub_1402288D0` | Update internal container with instance handle | Used from `sub_140224270` right after object creation/caching |
| `sub_1402281A0` | Initialize display list container | Called in `sub_140221260` constructor-like initializer |
| `sub_140228340` | Destroy display list container | Called in `sub_1402213C0` destructor |
| `sub_140227EB0` | Register instance into a global list (render/update) | Called in `sub_140224270` after object creation |
| `sub_140227590` | Register sprite/instance into higher-level engine | Called in `sub_140221440` when `a1 + 512` exists |
| `sub_140224B40` | Trigger actions/events based on flags | Called in `sub_140221440` before first-frame apply |
| `sub_1401CFFC0` | Build execution context token | Used before action/event dispatch (`sub_140227*`) |


