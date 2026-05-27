# 推敲 Trace

> 写作如推敲 — 删减可见，改动留痕。

一款**纯本地**的浏览器端写作编辑器。所有数据存储在浏览器内，无需注册账号，无需网络连接。灵感来自贾岛"僧推月下门"——写作本就是一个反复推敲的过程，删除的文字不是垃圾，而是思考的痕迹。

## ✨ 特性

### 核心理念：改动留痕

在推敲 Trace 中，你删除的文本**不会消失**，而是以 ~~删除线~~ 显示。这让每一次修改都有据可查，回过头来看自己的思考演变过程。

- 正常输入文本实时显示
- 退格删除时文本变为删除线状态，而非移除
- 可一键切换"显示/隐藏已删除内容"
- 导出时可选择"留痕版"或"纯净版"

### 两种作品类型

| | 单篇文章 | 多章节书 |
|---|---|---|
| 适用场景 | 随笔、日记、短文 | 长篇小说、系列文章 |
| 章节管理 | 无 | 侧边栏章节列表，可增删切换 |
| 导出 | 单文件 | 按章节分别导出，或合并导出 |
| 字数统计 | 单篇 | 全书汇总 + 各章节独立统计 |

### 导出格式

| 格式 | 留痕版 | 纯净版 | 用途 |
|------|--------|--------|------|
| .doc (Word) | 删除线 + 灰色标记 | 仅最终文本 | 办公软件打开编辑 |
| .png (图片) | 删除线 + 灰色标记 | 仅最终文本 | 分享到社交平台 |
| .txt (纯文本) | — | 自动过滤已删除内容 | 无格式迁移 |
| .tracebook | 包含完整修改历史 | — | 项目备份/迁移 |
| Markdown | 删除线 ~~标记~~ | — | 技术文档 |

### 界面定制

**四种主题**

- 暖黄 — 默认主题，类纸张底色，适合长时间写作
- 浅色 — 高对比度白底，适合亮光环境
- 暗色 — 深色背景，适合夜间写作
- 护眼 — 低饱和绿色底，减轻视觉疲劳

所有主题通过 CSS 变量实现，切换即时生效。

**字体**

- 内置 8 款免费商用中文字体：霞鹜文楷、思源宋体、思源黑体、站酷仓耳、方正书宋、更纱黑体、衬线/无衬线系统默认
- 支持导入本地字体文件（.ttf / .otf / .woff2），存储在浏览器文件系统中，清缓存不丢失

**页宽与行距**

- 页宽：窄（600px）/ 中（760px）/ 宽（900px）/ 自定义 px 值
- 行距：1.6 / 1.8 / 2.0 / 2.2 / 自定义数值

### 快捷键

内置快捷键系统，所有快捷键**允许用户自定义修改**：

| 功能 | 默认快捷键 |
|------|-----------|
| 切换已删除内容显示 | Ctrl+H |
| 加粗 | Ctrl+B |
| 斜体 | Ctrl+I |
| 行距选择 | —（仅工具栏按钮） |

可添加快捷键提示栏（编辑器底部），也可选择隐藏。

### PWA 支持

- 可安装为独立桌面应用（浏览器地址栏会出现安装按钮）
- Service Worker 缓存机制，**已打开的文档断网也能继续写作**
- 无后台同步上传，始终本地优先

### 数据安全

- 使用浏览器 OPFS（Origin Private File System）存储，数据完全在本地
- 无任何后端服务、无遥测、无数据收集
- 支持 .tracebook 格式导入导出，方便备份迁移
- 编辑时自动保存到 localStorage 作为崩溃恢复安全网

## 🛠 技术架构

### 技术栈

| 层 | 选型 | 说明 |
|---|------|------|
| 框架 | React 19 + TypeScript | 严格类型，无 `any` 逃逸 |
| 状态管理 | Zustand | 轻量，分 editorStore + projectStore |
| 构建 | Vite | 秒级 HMR，生产构建 ~370KB gzip ~114KB |
| 存储 | OPFS | 持久化文件系统，支持目录结构 |
| 编辑器 | contentEditable + beforeinput 拦截 | 无第三方编辑器依赖 |
| PWA | Service Worker + Manifest | 离线缓存，可安装 |
| 测试 | Vitest | 57 个测试，覆盖核心逻辑 |
| 导出 | html-to-image | 仅 PNG 导出依赖 |
| CSS | 纯 CSS 变量 + 主题切换 | 零运行时 UI 库 |

### 目录结构

```
src/
├── App.tsx                # 顶层视图路由（仪表盘 / 编辑器）
├── App.css                # 全局样式 + 4 套主题变量
├── main.tsx               # 入口
├── types.ts               # 所有 TypeScript 类型定义
│
├── storage/               # 持久化层
│   ├── opfs.ts            # OPFS 底层操作（读写删查）
│   ├── projects.ts        # 项目 CRUD + 章节读写
│   ├── settings.ts        # 用户设置（主题/字体/快捷键）
│   ├── crashSave.ts       # 崩溃恢复快照（localStorage）
│   ├── io.ts              # .tracebook 导入导出
│   └── index.ts           # 统一导出
│
├── store/                 # 状态管理
│   ├── editorStore.ts     # 编辑器状态（文档内容、光标、格式化）
│   ├── projectStore.ts    # 项目管理状态（列表、打开、切换章节）
│   └── index.ts           # 统一导出
│
├── engine.ts              # 编辑器核心：文本操作、光标恢复、段落管理
├── Editor.tsx             # 编辑器主体（contentEditable 容器 + 事件处理）
├── EditorLayout.tsx       # 编辑器整体布局（顶栏 + 侧边栏 + 编辑区）
├── EditorHeader.tsx       # 编辑器顶部栏（标题、导出菜单）
├── ChapterSidebar.tsx     # 章节侧边栏（书类型项目）
├── ParagraphBlock.tsx     # 段落渲染组件
├── Toolbar.tsx            # 格式工具栏（加粗/斜体/行距/隐藏切换）
├── CopyModal.tsx          # 复制弹窗
│
├── Dashboard.tsx          # 项目仪表盘（项目列表）
├── ProjectCard.tsx        # 项目卡片
├── NewProjectDialog.tsx   # 新建项目弹窗
├── SettingsDialog.tsx     # 设置面板（5 个标签页）
│
├── export.ts              # 导出引擎（纯文本/Markdown/HTML/Word/PNG/书籍合并）
├── i18n.ts                # 国际化（中/英，零依赖 useSyncExternalStore）
│
└── __tests__/             # 测试文件
    ├── engine.test.ts     # 编辑器核心测试
    ├── export.test.ts     # 导出功能测试
    └── storage/
        └── opfs.test.ts   # OPFS 存储层测试
```

### OPFS 存储结构

```
trace_projects/               ← navigator.storage.getDirectory()
  projects/
    {uuid-1}/                 ← 单篇文章
      meta.json               ← { id, title, type, createdAt, updatedAt, wordCount }
      content.json            ← Document（段落/内联节点/样式）
    {uuid-2}/                 ← 多章节书
      meta.json               ← ProjectMeta
      toc.json                ← { chapters: [{ id, title }] }
      chapters/
        ch_001.json           ← Document
        ch_002.json           ← Document
  fonts/                      ← 用户导入的字体文件
    {font-name}.ttf
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/{your-username}/trace.git
cd trace

# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 运行全部测试
npm run test

# TypeScript 类型检查
npx tsc --noEmit

# 生产构建
npm run build
# 产出在 dist/ 目录
```

### 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 进入仓库 **Settings → Pages**
3. Source 选择 **GitHub Actions**，选择 Vite 部署模板
4. 每次 `git push` 自动部署

### 其他托管平台

`dist/` 目录为完整静态站点，可一键部署到：

- **Vercel** — `vercel --prod`
- **Netlify** — 拖拽 `dist/` 到 Netlify 面板
- **Nginx** — 将 `dist/` 设为 `root`

## 🌐 浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|---------|------|
| Chrome | 86+ | 完全支持 |
| Edge | 86+ | 完全支持 |
| Opera | 72+ | 完全支持 |
| Firefox | — | OPFS 支持不完整，应用会提示兼容信息 |
| Safari | — | 不支持 OPFS，应用会提示兼容信息 |

> 隐私/无痕模式下 OPFS 不可用，请使用常规浏览器窗口。

## 📄 License

MIT

---

<p align="center">
  <i>吟安一个字，拈断数茎须。</i>
</p>
