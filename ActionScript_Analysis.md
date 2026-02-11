# LMB ActionScript 字节码分析

## 概述

本文档记录了通过 IDA Pro 对游戏可执行文件反编译分析得到的 LMB `action_script` 标签（tag type `0xF005`）的完整结构、字节码格式、以及引擎执行流程。

LMB 格式继承了 Flash SWF 的 ActionScript 架构：
- **action_script 标签**（`0xF005`）存储所有 action 的字节码，是一个包含多条 action 的二进制 blob
- **do_action 标签**（`0x000C`）出现在帧的 children 中，通过 `action_id` 索引到 action_script 中的具体字节码
- 引擎在运行时解析 action_script 构建 action 表，播放时按 `action_id` 查找并执行对应字节码

---

## action_script 标签的二进制结构

### Tag 头部

与所有 LMB tag 一致：

| Offset | Size | Field |
|-------:|-----:|-------|
| +0 | 2 | tag_type = `0xF005` |
| +2 | 2 | offset = `0` |
| +4 | 4 | data_len（单位：4 bytes） |

### Tag Data 内容

tag data 的字节流结构如下（小端序）：

```
┌─────────────────────────────────────────────┐
│ u32  num_actions                            │  ← action 总数
├─────────────────────────────────────────────┤
│ Action Entry 0:                             │
│   u32  byte_length                          │  ← 本 action 字节码的字节长度
│   u8[byte_length]  bytecodes                │  ← 实际字节码（以 0x00 结尾）
│   u8[pad]  padding                          │  ← 填充到 4 字节对齐
├─────────────────────────────────────────────┤
│ Action Entry 1:                             │
│   u32  byte_length                          │
│   u8[byte_length]  bytecodes                │
│   u8[pad]  padding                          │
├─────────────────────────────────────────────┤
│ ...                                         │
└─────────────────────────────────────────────┘
```

### 结构推导过程

通过多个 LMB 文件的实际数据验证：

| 文件 | Tag data (u32 words) | 解析 |
|------|---------------------|------|
| attract_extreme.lmb | `[1, 3, 7]` | 1 action: byteLen=3, bytecodes=`07 00 00 00` → stop() |
| gamemode_info.lmb | `[1, 3, 7]` | 1 action: byteLen=3, bytecodes=`07 00 00 00` → stop() |
| machineselect.lm | `[3, 3, 7, 8, ...]` (22 words) | 3 actions — 见下方详细分析 |
| CMN_ALLNET_ICON00.lmb | `[7, 3, 7, 18, 918, ...]` (长) | 7 actions: 含复杂 AS2 脚本 |

**machineselect.lm 详细解析：**

```
Word  0: num_actions = 3
Word  1: action[0].byteLength = 3
Word  2: action[0].bytecodes = 0x00000007 → bytes: 07 00 00 00
           → 0x07 (stop), 0x00 (end), 0x00 (pad)
           → Action 0 = stop()   ✓ (出现 286 次，在每个 labeled section 末尾)

Word  3: action[1].byteLength = 8
Words 4-5: action[1].bytecodes:
           8c 02 00 2e 00 06 00 00
           → 0x8C (gotoLabel) len=2 symIdx=0x002E=46 → "Weapon_01_mc"
           → 0x06 (play)
           → 0x00 (end)
           → Action 1 = gotoAndPlay("Weapon_01_mc")   (出现 1 次)

Word  6: action[2].byteLength = 60
Words 7-21: action[2].bytecodes (60 bytes):
           96 0a 00 08 20 07 01 00 00 00 09 b5 01 1c ...
           → 以 0x96 (ActionPush) 开头的复杂 AS2 脚本
           → Action 2 = 复杂脚本   (出现 2 次)
```

### 验证公式

```
total_tag_words = 1 + Σ(1 + ceil(action[i].byteLength / 4)) for i = 0..num_actions-1
```

machineselect: 1 + (1+1) + (1+2) + (1+15) = 1 + 2 + 3 + 16 = 22 ✓
attract_extreme: 1 + (1+1) = 3 ✓

---

## 字节码格式

### 操作码表

从引擎函数 `sub_1401D2810`（地址 `0x1401D2810`）反编译得到的**简单操作码**：

| 操作码 | 十进制 | 名称 | 操作数 | 行为 | 对应 SWF |
|--------|--------|------|--------|------|----------|
| `0x00` | 0 | end | 无 | 终止字节码执行 | ActionEnd |
| `0x04` | 4 | nextFrame | 无 | 调用 Tick() 推进一帧 + stopped=true | ActionNextFrame |
| `0x05` | 5 | prevFrame | 无 | GotoFrame(prevFrameWrapped) + stopped=true | ActionPreviousFrame |
| `0x06` | 6 | play | 无 | 设置 stopped=false（恢复播放） | ActionPlay |
| `0x07` | 7 | stop | 无 | 设置 stopped=true（暂停播放） | ActionStop |
| `0x81` | 129 | gotoFrame | 4 bytes | GotoFrame(frame+1) + stopped=true | ActionGotoFrame |
| `0x8C` | 140 | gotoLabel | 4 bytes | GotoLabel(symbols[idx]) + stopped=true | ActionGoToLabel |

### 操作数格式

对于操作码 ≥ `0x80`，操作数格式为（与 SWF ActionRecord 一致）：

```
[opcode: 1 byte]
[length_lo: 1 byte]   ← 操作数数据长度（低字节）
[length_hi: 1 byte]   ← 操作数数据长度（高字节）
[data: length bytes]   ← 实际数据
```

#### gotoFrame (0x81) 操作数详情

```
[0x81] [0x02] [0x00] [frame_lo] [frame_hi]
```
- length = 2（固定）
- frame = frame_lo | (frame_hi << 8)
- 引擎调用 GotoFrame(frame + 1)（引擎使用 1-based 帧索引）

#### gotoLabel (0x8C) 操作数详情

```
[0x8C] [0x02] [0x00] [sym_lo] [sym_hi]
```
- length = 2（固定）
- symbolIndex = sym_lo | (sym_hi << 8)
- 引擎从符号表（symbols 资源表）查找字符串
- 调用 GotoLabel(symbolString) 跳转到对应帧标签

> **注意**：与标准 SWF 不同，LMB 的 gotoLabel 使用**符号表索引**而不是内联字符串。

#### prevFrame (0x05) 的帧计算公式

```c
target = ((unsigned)(numFrames + currentFrame - 1)) % numFrames + 1
```

- 使用 1-based 索引调用 GotoFrame
- 自动 wrap-around：frame 0 → 回到最后一帧

### 复杂操作码（AS2 虚拟机）

操作码不在上述简单列表中的，会被转交给完整的 ActionScript 2 虚拟机（`sub_1401D2D70`，函数体约 16KB）处理。常见的 AS2 操作码包括：

| 操作码 | 名称 | 说明 |
|--------|------|------|
| `0x96` | ActionPush | 将值压入栈 |
| `0x1C` | ActionGetVariable | 获取变量 |
| `0x1D` | ActionSetVariable | 设置变量 |
| `0x17` | ActionPop | 弹出栈顶 |
| `0x4E` | ActionGetMember | 获取对象成员 |
| `0x52` | ActionCallMethod | 调用方法 |
| `0x09` | ActionStringEquals | 字符串相等比较 |

> 对于 Preview 项目，**暂不需要实现 AS2 虚拟机**。简单操作码覆盖了绝大多数 UI 动画场景。

---

## 引擎执行流程

### 关键函数地址

| 地址 | 函数名/角色 | 说明 |
|------|------------|------|
| `0x1401D2810` | **BytecodeInterpreter_Simple** | 处理简单操作码 (stop/play/goto) |
| `0x1401D2A00` | **BytecodeInterpreter_Dispatch** | 调度：先尝试简单→不认识的交给 AS2 |
| `0x1401D2D70` | **BytecodeInterpreter_AS2** | 完整 AS2 虚拟机 (~16KB) |
| `0x1402277D0` | **ActionDispatch** | 从 action table 查找字节码并调用解释器 |
| `0x140227730` | **ActionTrigger** | 解析事件/条件并分派 action |
| `0x1402272C0` | **EnqueueMovieAction** | 创建 `lumen::MovieAction` 入队 |
| `0x1402273B0` | **EnqueueLoadAction** | 创建 `lumen::LoadAction` 入队 |
| `0x1402274A0` | **EnqueueUnloadAction** | 创建 `lumen::UnloadAction` 入队 |
| `0x140224B40` | **TriggerEvents** | 根据事件掩码触发对应 action |
| `0x1402227E0` | **GotoLabel** | 按标签名跳转到帧 |
| `0x140222740` | **Sprite::Tick** | 推进一帧 |
| `0x1402222F0` | **Sprite::GotoFrame** | 跳转到指定帧（含 keyframe rebuild） |

### 执行链路

```
帧推进 / 跳转
    → sub_140223A90 (ApplyFramesRange)
        → 扫描帧 children，遇到 tagType=12 (do_action)
            → sub_140224B40 (TriggerEvents)
                → 查找事件表，匹配 action_id
                → 创建 Action 对象入队:
                    - MovieAction (默认)
                    - LoadAction (事件标志=1)
                    - UnloadAction (事件标志=2)
                → 或直接调用 sub_1402277D0 (ActionDispatch)
                    → 从 action table 取 bytecodePtr + byteLength
                    → sub_1401D2A00 (Dispatch)
                        → sub_1401D2810 (简单解释器)
                            → 处理 stop/play/goto 等
                        → 若有未识别操作码:
                            → sub_1401D2D70 (AS2 虚拟机)
```

### Action Table 运行时结构

引擎在加载 action_script 标签后，在运行时对象的偏移 `+104` 处构建 action table：

```
action_table = *(qword*)(sprite_definition + 104)
entry = action_table + 16 * action_id

Entry layout (16 bytes):
  +0:  u32  bytecodeByteLength
  +4:  u32  (padding/alignment)
  +8:  u64  bytecodePointer  → 指向 action_script tag data 中的字节码
```

### do_action 标签字段

```
do_action tag (tagType = 0x000C):
  +8:  u32  action_id    ← 索引到 action table
  +12: u32  unknown      ← 始终观察到为 0
```

### stopped 标志位

引擎在 Sprite 对象的偏移 `+504` 处维护一个 `stopped` 字节标志：
- `0` = 正在播放（playing）
- `1` = 已停止（stopped）

字节码操作直接修改此标志：
- `stop()` / `gotoFrame()` / `gotoLabel()` / `nextFrame()` / `prevFrame()` → 设置 stopped = 1
- `play()` → 设置 stopped = 0
- `gotoLabel()` 仅在成功找到标签时设置 stopped = 1

这意味着：
- `[0x8C ... 0x06 0x00]` = gotoLabel + play = **gotoAndPlay(label)**
- `[0x8C ... 0x00]` = gotoLabel = **gotoAndStop(label)**
- `[0x81 ... 0x06 0x00]` = gotoFrame + play = **gotoAndPlay(frame)**
- `[0x07 0x00]` = stop = **stop()**

---

## 符号表引用

gotoLabel 操作码中的 `symbolIndex` 引用 LMB 文件的 **symbols 资源表**（tag `0xF001`）。

引擎在运行时通过以下路径解析：

```c
// 从 sprite 上下文获取符号表
symbolTable = *(qword*)(*(qword*)(sprite + 48) + 64)
// 按索引获取字符串指针
labelString = *(qword*)(symbolTable + 8 * symbolIndex)
```

在 Preview 中，我们的 `resources.symbols[symbolIndex].value` 就是对应的字符串。

---

## 三种 Action 类型（事件系统）

引擎定义了三种 Action 对象类型（通过 RTTI vtable 确认）：

| 类型 | vtable 名称 | 创建函数 | 触发条件 |
|------|------------|---------|---------|
| MovieAction | `lumen::MovieAction` | `sub_1402272C0` | 默认/帧动作 |
| LoadAction | `lumen::LoadAction` | `sub_1402273B0` | 事件标志 = 1 |
| UnloadAction | `lumen::UnloadAction` | `sub_1402274A0` | 事件标志 = 2 |

这些 Action 被创建后入队到链表中延迟执行，而不是立即执行。
对于 Preview 的初步实现，可以忽略事件系统，直接在帧处理时执行字节码。

---

## AS2 虚拟机完整操作码表

### 来源

通过读取引擎函数 `sub_1401D2D70` 的 switch 跳转表 `byte_1401D6D08`（160 字节），确定了引擎实际处理的所有操作码。跳转表中 `0x59` = default（未处理），其他值为 case 索引。

### 完整操作码映射表（89 个 case）

#### 栈操作

| 操作码 | 名称 | 行为 | Preview 实现 |
|--------|------|------|-------------|
| `0x96` | ActionPush | 将值压入栈（支持 10 种数据类型） | ✅ 已实现 |
| `0x17` | ActionPop | 弹出栈顶 | ✅ 已实现 |
| `0x4C` | ActionPushDuplicate | 复制栈顶 | ✅ 已实现 |
| `0x4D` | ActionStackSwap | 交换栈顶两元素 | ✅ 已实现 |

#### 变量 / 成员访问

| 操作码 | 名称 | 行为 | Preview 实现 |
|--------|------|------|-------------|
| `0x1C` | ActionGetVariable | 弹出变量名，压入变量值 | ✅ 已实现（this / _root / 子 clip 名） |
| `0x1D` | ActionSetVariable | 弹出值和名称，设置变量 | ✅ 日志记录 |
| `0x4E` | ActionGetMember | 弹出成员名和对象，压入 obj[member] | ✅ 已实现（子 MovieClip 查找 + 内置属性） |
| `0x4F` | ActionSetMember | 弹出值、成员名、对象，设置 obj[member] | ✅ 日志记录 |
| `0x22` | ActionGetProperty | 按属性索引获取显示对象属性 | ✅ 已实现 |
| `0x23` | ActionSetProperty | 按属性索引设置显示对象属性 | ✅ 日志记录 |

#### 函数 / 方法调用

| 操作码 | 名称 | 行为 | Preview 实现 |
|--------|------|------|-------------|
| `0x52` | ActionCallMethod | 调用对象方法 | ✅ 已实现（gotoAndPlay/gotoAndStop/play/stop） |
| `0x3D` | ActionCallFunction | 调用全局函数 | ⚠️ 日志 + 跳过 |
| `0x3E` | ActionReturn | 从函数返回 | ✅ 已实现 |

#### 算术

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x0A` | ActionAdd | ✅ |
| `0x0B` | ActionSubtract | ✅ |
| `0x0C` | ActionMultiply | ✅ |
| `0x0D` | ActionDivide | ✅ |
| `0x3F` | ActionModulo | ✅ |
| `0x47` | ActionAdd2 | ✅（支持字符串连接） |
| `0x50` | ActionIncrement | ✅ |
| `0x51` | ActionDecrement | ✅ |

#### 比较 / 逻辑

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x0E` | ActionEquals | ✅ |
| `0x0F` | ActionLess | ✅ |
| `0x10` | ActionAnd | ✅ |
| `0x11` | ActionOr | ✅ |
| `0x12` | ActionNot | ✅ |
| `0x13` | ActionStringEquals | ✅ |
| `0x29` | ActionStringLess | ✅ |
| `0x48` | ActionLess2 | ✅ |
| `0x49` | ActionEquals2 | ✅ |
| `0x66` | ActionStrictEquals | ✅ |
| `0x67` | ActionGreater | ✅ |
| `0x68` | ActionStringGreater | ✅ |

#### 位运算

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x60` | ActionBitAnd | ✅ |
| `0x61` | ActionBitOr | ✅ |
| `0x62` | ActionBitXor | ✅ |
| `0x63` | ActionBitLShift | ✅ |
| `0x64` | ActionBitRShift | ✅ |
| `0x65` | ActionBitURShift | ✅ |

#### 控制流

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x99` | ActionJump | ✅ |
| `0x9D` | ActionIf | ✅ |

#### 类型转换

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x18` | ActionToInteger | ✅ |
| `0x4A` | ActionToNumber | ✅ |
| `0x4B` | ActionToString | ✅ |
| `0x44` | ActionTypeOf | ✅ |

#### 字符串

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x14` | ActionStringLength | ✅ |
| `0x15` | ActionStringExtract | ⚠️ 跳过 |
| `0x21` | ActionStringAdd | ✅ |
| `0x31` | ActionMBStringLength | ✅ |
| `0x35` | ActionMBStringExtract | ⚠️ 跳过 |

#### 对象

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x40` | ActionNewObject | ⚠️ 日志 + 跳过 |
| `0x42` | ActionInitArray | ✅ 消费栈参数 |
| `0x43` | ActionInitObject | ✅ 消费栈参数 |
| `0x3C` | ActionDefineLocal | ✅ 日志 |
| `0x41` | ActionDefineLocal2 | ✅ 日志 |
| `0x3A` | ActionDelete | ✅ |
| `0x3B` | ActionDelete2 | ✅ |
| `0x46` | ActionEnumerate | ✅ |
| `0x55` | ActionEnumerate2 | ✅ |
| `0x54` | ActionInstanceOf | ✅ |
| `0x45` | ActionTargetPath | ✅ |
| `0x69` | ActionExtends | ✅ |

#### 扩展操作码（带操作数）

| 操作码 | 名称 | Preview 实现 |
|--------|------|-------------|
| `0x87` | ActionStoreRegister | ✅ |
| `0x88` | ActionConstantPool | ✅ 已实现 |
| `0x8B` | ActionSetTarget | ⚠️ 跳过 |
| `0x8E` | ActionDefineFunction2 | ⚠️ 跳过 |
| `0x94` | ActionWith | ⚠️ 跳过 |
| `0x9B` | ActionDefineFunction | ⚠️ 跳过 |
| `0x9F` | ActionGotoFrame2 | ⚠️ 跳过 |

#### NOP 操作码（引擎中不执行或静默处理）

| 操作码 | 名称 |
|--------|------|
| `0x08` | ToggleQuality |
| `0x09` | StopSounds |
| `0x27` | StartDrag |
| `0x28` | EndDrag |
| `0x2A` | Throw |
| `0x2B` | CastOp |
| `0x2C` | ImplementsOp |

### ActionPush 数据类型

ActionPush (`0x96`) 的操作数数据由多个连续的 Push 条目组成，每条以类型字节开头：

| 类型字节 | 名称 | 数据格式 | Preview 实现 |
|----------|------|---------|-------------|
| `0` | String | null-terminated 字符串 | ✅ |
| `1` | Float | 4 bytes IEEE 32-bit | ✅ |
| `2` | Null | 无数据 | ✅ |
| `3` | Undefined | 无数据 | ✅ |
| `4` | Register | 1 byte 寄存器索引 | ✅ |
| `5` | Boolean | 1 byte (0=false, 1=true) | ✅ |
| `6` | Double | 8 bytes IEEE 64-bit | ✅ |
| `7` | Integer | 4 bytes 有符号整数 | ✅ |
| `8` | Constant8 | 1 byte 常量池索引 | ✅ |
| `9` | Constant16 | 2 bytes 常量池索引 | ✅ |

**常量池解析**：Constant8/Constant16 引用的常量池可由两种方式提供：
1. **ActionConstantPool (0x88)** — 字节码内联定义的局部常量池
2. **符号表 (symbols)** — 当无局部常量池时，引擎使用 LMB 文件的全局符号表

在 machineselect 的 Action 2 中，没有 ActionConstantPool 指令，Constant8[32] 和 Constant16[437..440] 直接引用符号表。

### machineselect Action 2 字节码完整解码

```
96 0A 00    ActionPush (length=10)
  08 20       Constant8[32] = "Start"
  07 01 00 00 00  Integer(1)
  09 B5 01    Constant16[437] = "this"
1C          ActionGetVariable → pop "this", push thisClip
96 03 00    ActionPush (length=3)
  09 B6 01    Constant16[438] = "TitleBase_Left_mc"
4E          ActionGetMember → pop "TitleBase_Left_mc", pop thisClip, push thisClip.TitleBase_Left_mc
96 03 00    ActionPush (length=3)
  09 B7 01    Constant16[439] = "gotoAndPlay"
52          ActionCallMethod → pop "gotoAndPlay", pop clip, pop 1, pop "Start"
                              → thisClip.TitleBase_Left_mc.gotoAndPlay("Start")
17          ActionPop → discard return value

96 0A 00    ActionPush (length=10)
  08 20       Constant8[32] = "Start"
  07 01 00 00 00  Integer(1)
  09 B5 01    Constant16[437] = "this"
1C          ActionGetVariable
96 03 00    ActionPush (length=3)
  09 B8 01    Constant16[440] = "TitleBase_Right_mc"
4E          ActionGetMember
96 03 00    ActionPush (length=3)
  09 B7 01    Constant16[439] = "gotoAndPlay"
52          ActionCallMethod → thisClip.TitleBase_Right_mc.gotoAndPlay("Start")
17          ActionPop

00 00       End
```

**等价 ActionScript 2 代码：**
```actionscript
this.TitleBase_Left_mc.gotoAndPlay("Start");
this.TitleBase_Right_mc.gotoAndPlay("Start");
```

---

## 对 Preview 实现的影响

### 已实现

1. ✅ **解析 action_script 标签**：从二进制数据中提取 `[action_id → bytecode[]]` 映射
2. ✅ **简单字节码解释器**：实现 stop / play / gotoFrame / gotoLabel / nextFrame / prevFrame
3. ✅ **符号表查找**：gotoLabel 需要通过 symbolIndex 查找标签名
4. ✅ **帧标签匹配**：将标签名与 sprite 的 frameLabels 匹配，找到目标帧
5. ✅ **AS2 栈虚拟机**：实现 ActionPush / GetVariable / GetMember / CallMethod 等核心操作码
6. ✅ **子 MovieClip 方法调用**：支持 gotoAndPlay / gotoAndStop / play / stop 调用子 clip
7. ✅ **实例名称解析**：从 PlaceObject.nameId 解析实例名，用于子 clip 查找

### 可以暂不实现的

1. **Action 队列系统**（MovieAction/LoadAction/UnloadAction 的延迟执行）—— 直接同步执行即可
2. **Button 事件系统**（TriggerEvents 的事件掩码匹配）—— UI 交互相关
3. **DefineFunction/DefineFunction2** — 自定义函数定义
4. **SetTarget / With** — 作用域切换

### 预期效果

实现 AS2 栈虚拟机后，UI 动画（如 machineselect 的机体选择画面）中的：
- 嵌套 sprite 在正确的帧标签处 stop
- 通过 gotoAndPlay 切换到正确的动画段
- 保持正确的播放/停止状态
- AS2 脚本可以控制子 MovieClip 的跳转和播放（如 `this.TitleBase_Left_mc.gotoAndPlay("Start")`）

---

## 附录：验证用脚本

可使用以下 bun 脚本从 LMB 文件中提取和验证 action bytecodes：

```typescript
import { decodeLmbAst } from './lmbast';
import * as fs from 'fs';

const buf = fs.readFileSync('machineselect.lm');
const ast = decodeLmbAst(Buffer.from(buf));

for (const tag of ast.tags) {
  if (tag.kind === 'actionScript') {
    const words = tag.data.bytecodeWords;
    const bytes: number[] = [];
    for (const w of words) {
      bytes.push(w & 0xFF, (w >> 8) & 0xFF, (w >> 16) & 0xFF, (w >> 24) & 0xFF);
    }

    let offset = 0;
    const numActions = bytes[offset] | (bytes[offset+1] << 8)
                     | (bytes[offset+2] << 16) | (bytes[offset+3] << 24);
    offset += 4;

    console.log(`num_actions: ${numActions}`);
    for (let i = 0; i < numActions; i++) {
      const byteLen = bytes[offset] | (bytes[offset+1] << 8)
                    | (bytes[offset+2] << 16) | (bytes[offset+3] << 24);
      offset += 4;
      const bc = bytes.slice(offset, offset + byteLen);
      const padded = Math.ceil(byteLen / 4) * 4;
      offset += padded;
      console.log(`  action[${i}]: ${byteLen} bytes: ${bc.map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
    }
  }
}
```
