# 推敲 (Trace) - 核心产品与技术需求文档 (PRD) v4.0 (研发落地版)

## 1. 产品愿景与技术底线
- **产品名称**：推敲 (Trace)
- **核心理念**：视觉化软删除（留痕），保留创作者推敲的意识流。赋予数字写作以纸笔手稿的“安全感”与“厚重感”。
- **技术底线锁定**：
  - **基于跨度的模型**：彻底摒弃原生 `<textarea>` 和单字节点，采用 Block(段落块) 嵌套 Inline Span(行内跨度) 的数据模型。
  - **本地存储架构**：采用 **Zip 封装 JSON (类似 OXML 思路)** 的 `.tracebook` 单文件方案，严禁使用单一大 JSON，以防大文件 IO 阻塞和数据火葬场。
  - **极致轻量**：前端依赖极简 DOM/CSS 渲染，不引入 Canvas/html2canvas 等重型渲染引擎，UI 样式通过极其受限的白名单控制。

## 2. 核心编辑与交互逻辑 (深水区边界定义)

### 2.1 软删除与真删除的严谨判定
废除任何硬编码的“字数限制”，统一采用基于“选区状态 (Selection)”的安全锁规则：

- **软删除 (Soft Delete) [默认高频行为]**：
  - **触发**：`Backspace`，`Delete`，及系统原生词/行删除快捷键（如 `Cmd + Backspace`）。
  - **行为**：底层不移除任何文本或块元素，对目标跨度打上 `status: 'deleted'` 状态标签。视觉上表现为灰色加删除线。

- **真删除 (Hard Delete) [纠正 Typo 的极客行为]**：
  - **触发**：`Shift + Backspace`。
  - **安全锁判定**：
    1. **仅在光标闭合状态 (Collapsed Selection，即未框选任何文字)** 时允许执行。按下时，真正从内存销毁光标前的一个字符。
    2. 如果当前**存在选区 (Selection.isCollapsed === false)**，不管选中了 1 个字还是整整一章，只要按下 `Shift + Backspace`，**系统强制无视真删请求，自动降级按“软删除”处理**。绝不允许一键真删选区内容，防范误触灾难。

### 2.2 跨段落软删除逻辑 (换行符的软删)
由于采用了 Block 模型，换行符不是普通字符，采用**“段落强制合并 + 幽灵换行符占位”**机制：

- **场景定义**：光标在第二段开头，用户按下 Backspace 试图删除前一个换行符（即合并上一段）。
- **合并规则**：
  1. 第一段和第二段在底层数据结构上**强制合并**为一个 `Paragraph` 块。
  2. 在合并的交界缝隙处，系统自动插入一个特殊的行内跨度：`{ type: 'soft-break', status: 'deleted' }`。
- **视觉表现**：两段文字在屏幕上连成一段，但在交界处渲染出一个浅灰色的**“带删除线的段落标记符 (¶)”**。这既保留了曾有换行的历史痕迹，又符合块级元素合并的底层逻辑，且确保光标可以正常渲染。

### 2.3 选区覆盖粘贴 (Paste) 与跨段落处理
当用户按 `Ctrl+V` / `Cmd+V` 粘贴时，永远不能出现“真删被覆盖选区”的情况：

- **外部样式净化**：洗除所有外部字体、颜色、大小等属性，仅保留纯文本及加粗/斜体白名单。
- **单段落覆盖粘贴**：原有被选中的文本转为 `deleted` 状态，紧随其后插入 `normal` 状态的新文本。
- **跨段落覆盖粘贴 (逻辑黑洞解决方案)**：
  - **步骤 1**：将框选涉及到的所有段落合并为 1 个超级段落，原有的真实换行符全部转化为带删除线的 `soft-break` 幽灵符。所有被选中的原有文字转为 `deleted` 状态。
  - **步骤 2**：在这个超级段落的选区末尾，插入粘贴进来的新内容（`normal` 状态）。如果新内容本身包含真实的换行符，则按照正常的换行逻辑将这个超级段落重新切分为多个 `Paragraph`。

### 2.4 光标穿透与“废墟建房”规则
- **光标行为**：绝对允许光标进入处于 `deleted` 状态的连续废稿文本内部。
- **插入规则**：用户在一段被软删除的灰色废稿中间点击光标并开始打字，新输入的文字是 `normal` 状态。
- **底层变化**：系统自动将原本的 1 个 `deleted` Span 劈开，变成 `[deleted Span A] -> [normal 新内容] -> [deleted Span B]`。完全符合创作者在废稿中重新推敲、重构的直觉逻辑。

### 2.5 节点自动合并 (Normalization)
- **触发时机**：在任何增删改查、粘贴、软/真删除操作结束后，必须静默触发。
- **合并规则**：相邻的 `TextSpan` 若拥有完全相同的 `status` 且 `attributes` 一致，必须无条件合并为一个 Span。防止单字碎片化引发内存溢出和渲染卡顿。

### 2.6 IME 与输入法兼容
- 当 `isComposing === true`（中文拼音或外文组合输入中）时，必须**彻底放行**所有按键和 Backspace 行为，交由操作系统底层接管。只有在 `compositionend` 触发且文字实际上屏后，引擎才接管编辑逻辑。

---

## 3. 底层数据结构设计 (.tracebook 引擎)

### 3.1 核心数据接口 (TypeScript)
为支持“受限富文本”与“跨段落软删”，底层数据结构定义如下：

```typescript
// 样式白名单，拒绝字体颜色、字号等不受控属性
type AllowedStyles = { bold?: boolean; italic?: boolean; };
type TraceStatus = 'normal' | 'deleted';

// 常规文字跨度
interface TextSpan {
  type: 'text';
  insert: string;
  status: TraceStatus;
  attributes?: AllowedStyles;
}

// 幽灵换行符跨度（解决跨段软删难题，仅存在于段落内部）
interface SoftBreakSpan {
  type: 'soft-break';
  status: 'deleted'; // 只要存在此节点，必定是被软删除的换行符
}

type InlineNode = TextSpan | SoftBreakSpan;

// 段落块级元素
interface Paragraph {
  id: string; // 唯一标识符，用于文档树映射与协同比对
  children: InlineNode[]; // 包含文字片段和软删换行符
}

// 独立章节模型
interface Document {
  chapterId: string;
  paragraphs: Paragraph[];
}
```

### 3.2 存储架构 (Zip OXML 方案)
项目文件后缀为 `.tracebook`，本质上是通过 Zip 算法打包的结构化文件夹。支持最大 5 层树状目录，章节数据独立切割，按需懒加载。

```text
/my_novel.tracebook (ZIP文件结构)
├── metadata.json           # 项目全局配置（作者、创建时间、版本号、字数统计）
├── toc.json                # 章节树结构与排序定义 (映射 folder/file 到 chapter_id)
├── chapters/               # 章节数据池 (按章隔离，避免百万字全量 IO 阻塞)
│   ├── ch_001.json         # 包含 Document 数据模型 (序列化 JSON)
│   └── ch_002.json
└── backups/                # 本地定时快照容灾备份 (防文件损坏)
```

## 4. 导出系统 (Export)
1. **纯文本 (.txt)**：遍历解析。过滤掉所有 `status: 'deleted'` 的 `TextSpan` 和所有的 `SoftBreakSpan`，仅输出纯净成稿。
2. **Markdown (.md)**：`deleted` 状态的 `TextSpan` 转为 `~~文字~~`；`SoftBreakSpan` 转为特定的 HTML 注释标签（如 `<!-- deleted break -->`）或在输出时忽略。
3. **分享截图**：依靠 Tauri / Capacitor 的 WebView 原生 API，或通过前端轻量级 SVG 转换，实现对特定段落带推敲痕迹的高清截屏分享。

---

## 5. 致开发 AI (Claude Code) 及研发团队的任务指引

作为核心研发力量，请严格遵守本 PRD 中定义的边界（尤其是 Normalization 机制与选区降级规则）。

**第一阶段开发任务（Step 1）：**
请基于 `Section 3.1` 提供的最新 TypeScript 接口，使用 React (或 Vanilla JS / 状态管理库如 Zustand) 编写核心状态引擎 `EditorCoreStore`。
1. **实现核心合并函数**：请编写处理段落软删合并的逻辑：`mergeParagraphs(para1Id, para2Id)`，必须准确在拼接处插入 `{ type: 'soft-break', status: 'deleted' }` 节点。
2. **实现跨度劈开逻辑**：请编写 `insertTextAt(paragraphId, offset, text)`。当 `offset` 落在 `deleted` Span 内部时，实现自动将该 Span 分割为三段（旧废稿左 -> normal 新内容 -> 旧废稿右）的“废墟建房”逻辑。
3. **强制实现清理算法**：实现 `normalizeParagraph(paragraphId)` 算法，保证相同属性和状态的连续 `TextSpan` 自动合并，清理碎片数据。
4. （注：当前阶段纯攻克底层状态机的内存数据流转，先不编写 DOM `contenteditable` 的选区光标渲染层代码）。
```