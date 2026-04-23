# LMB/Lumen UI Editor — 开发 TODO

## 最终目标

构建完整的 LMB/Lumen UI 预览与编辑工具，能够：
1. 正确渲染任意 LMB 动画（图形 + 文本 + 按钮）
2. 用真实游戏数据驱动交互式 UI（如 machineselect）
3. 模拟 C++ Controller 层的数据绑定行为
4. 支持键盘/手柄的游戏级交互

---

## P0 — 阻断性缺陷 ✅ 全部修复

- [x] **TextDef 渲染**: Canvas2D 叠加层实现，machineselect 的日文提示文本、武器文本、倒计时数字全部可见
- [x] **Stage 点击检测坐标系**: 从中心原点改为左上角原点，与实例 transform 一致
- [x] **AS2 VM `_root`/`_parent`**: `_root` 返回带 root 标记的引用，添加 `_parent` 占位
- [x] **AS2 VM `InitArray`/`InitObject`**: 现在正确构建数组和对象推入栈
- [x] **AS2 VM `StringExtract`/`MBStringExtract`**: 实现真正的 substring（AS2 1-based 索引）
- [x] **AS2 VM `nextFrame`/`prevFrame`**: 切换帧时重建显示列表（reset + 逐帧 applyFrame）
- [x] **AS2 VM `SetProperty`**: 新增 `_x`/`_y`/`_xscale`/`_yscale`/`_rotation` 日志支持

## P1 — 核心功能缺口 ✅ 全部完成

- [x] **LumenController 模拟层**: `lumen_controller.ts` 实现路径解析 + gotoAndStop/gotoAndPlay + 数字/Cost/Mastery 显示驱动
- [x] **路径式 MovieClip 解析器**: 支持 `/root_mc/child_mc` 深度递归解析，listAllPaths 调试功能
- [x] **数字显示驱动**: `setNumberDisplay` + `setCostLabel` + `setMasteryLabel`
- [x] **MachineSelectController**: 基于 ms_data.json 的选机控制器骨架

## P1.5 — 待接入（Controller 已实现但未接入 UI）

- [ ] **按钮状态机**: 当前按钮只使用 `graphics[0]`，缺少 Up/Over/Down/Hit 四状态模型
- [ ] **AS2 VM: `SetTarget`/`With`**: 当前被跳过
- [ ] **接入 MachineSelectController 到 GameControlPanel**: 让键盘操作真正驱动选机逻辑

## P2 — 重要改进（更好的兼容性和体验）

- [ ] **ExternalInterface 桥接模拟**: AS2 中 `flash.external.ExternalInterface.call("CallEffect", ...)` 与 C++ 的双向通信。在 preview 中实现为 JS 回调钩子。
- [ ] **关键帧加速路径验证**: `findNearestKeyframeIndex` 假设标签顺序 = keyframe 顺序，需增加断言或回退保护。若假设失败应 fallback 到完整重放。
- [ ] **`duplicateMovieClip` placementId 碰撞**: `10000 + depth` 硬编码可能与其他 placement 冲突，需改为全局递增 ID。
- [ ] **GameControlPanel 多实例精确控制**: 当前按 characterId 匹配第一个实例，需改为 placementId 精确定位，与 Inspector 选中实例联动。
- [ ] **devFixture 异步竞态**: 用户在 fixture 加载中操作可能覆盖状态。需 AbortController 或加载锁。
- [ ] **AS2 VM: 缺失内置对象**: `String`、`Array`、`Object`、`Key`、`Mouse`、`getTimer` 等 Flash 内置 API。
- [ ] **store.ts 防御性检查**: `getColorById` 对越界 id 无检查，需加 bounds guard。
- [ ] **URL 加载路径不支持 TextureBinding**: `loadAtlasTextures` 不使用 binding，文件名不一致时纹理加载失败。

## P3 — 数据与工具链

- [ ] **完善 ms_data.json**: 补充 series 名称（当前解密不完整）、burst type 名称映射、pilot 名称。
- [ ] **vs2 文本资源提取**: 解析 `010localizedtext/out/j_out.ntx` 等本地化文本（日文 UI 字符串），用于 TextDef 渲染。
- [ ] **machineselect 数据绑定映射文件**: 创建 JSON 描述 machineselect 中每个 sprite 路径对应的数据源和标签映射。
- [ ] **批量 LMB 转换脚本**: 自动转换 `009gui/flash/` 下所有 LM → JSON + PNG 的管道脚本。
- [ ] **更多 GUI 测试**: attract/title（2.1MB 标题画面）、game/vs（VS 画面）、game/briefing（任务简报）等。

## P4 — 编辑器级功能（长期）

- [ ] **Timeline 编辑器改进**: 嵌套 sprite 独立时间轴控制、帧级操作面板、label 可视化标记。
- [ ] **热重载**: 修改 JSON/纹理后无需刷新即可预览更新。
- [ ] **导出 LMB 二进制**: 实现 JSON → LMB 的逆向序列化（`jsontolmb.ts` 已存在但需验证）。
- [ ] **多分辨率预览**: 支持不同 stage 大小的缩放预览和像素对比。
- [ ] **性能优化**: 对 staffroll（3496帧 × 231实例）等大型动画的帧率优化。

---

## 已完成

- [x] P0 全部修复（TextDef渲染、坐标修复、AS2 VM 6项bug修复）— 2026-04-23
- [x] P1 全部完成（LumenController、路径解析、数字驱动、MachineSelectController）— 2026-04-23
- [x] LMB 文件格式解析与 JSON 转换（`lmbtojson.ts`）
- [x] WebGL 渲染器（图形、混合模式、颜色变换）
- [x] Scene 显示列表管理（Place/Move/Remove、嵌套 sprite）
- [x] TimelinePlayer（播放/暂停/scrub/区间/关键帧加速）
- [x] ActionInterpreter（AS2 栈式 VM 基础框架 + 大量 opcode）
- [x] lm_menu devFixture（48 纹理，74 实例，交互测试通过）
- [x] staffroll devFixture（3496 帧动画播放确认）
- [x] machineselect 转换 + devFixture（187 纹理，797 实例渲染正确）
- [x] GameControlPanel（键盘 ↑↓←→ Enter Esc + 虚拟方向键 + Action Log）
- [x] Stage 缩放控件（Fit/1:1/Fill + Zoom In/Out + ResizeObserver）
- [x] Inspector 可折叠切换
- [x] 自动播放（加载后自动循环）
- [x] IDA Pro 逆向：确认 Lumen 引擎、3 个核心控制函数、HUD 类体系、ExternalInterface
- [x] vs2 游戏数据提取：195 角色 + Cost/HP + 熟练度 + 觉醒参数
- [x] 字符串解密（`obfTransformByte` index%14 算法）
- [x] ms_data.json 精简版生成
- [x] GUI 全景扫描（13 类别，1800+ LM 文件）
