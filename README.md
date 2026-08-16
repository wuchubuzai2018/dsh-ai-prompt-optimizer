# DSH AI Prompt Optimizer

一个用于 DeepSeek Harness（DSH）Web 聊天页面的提示词优化插件。它会在输入框发送按钮旁添加 **“✨ AI 优化”**，帮助你把粗略想法整理成更清晰、完整、可直接发送给 AI 的提示词。

## 解决什么问题

临时输入的提示词常常会缺少目标、背景、约束或期望输出格式，导致模型回答不稳定。这个插件让你在发送前一键优化当前草稿：

- 保留原始意图、语言和已知事实；
- 补齐任务目标、上下文、约束、步骤和输出格式；
- 信息不足时列出最少且关键的待确认项；
- 优化结果只回填到输入框，不会自动发送，最终内容仍由你确认。

## 功能特性

- **一键优化**：读取当前输入框草稿并生成优化版本；
- **复用当前模型**：使用 DSH 已配置的默认模型，不需要单独配置 API Key；
- **发送前确认**：优化后不会自动提交，你可以继续编辑；
- **过程可见**：请求期间按钮显示“优化中…”；
- **失败可感知**：输入为空、模型不可用或调用失败时，会弹出明确提示；
- **更广模型兼容性**：只发送基础模型请求字段，避免部分 Provider 不支持可选参数而失败。

## 环境要求

- DeepSeek Harness Web `0.1.0-rc.6`；
- DSH 中已经配置可用的默认模型；
- 从源码安装时需要 Node.js 22+ 和 pnpm。

如果系统通过 Corepack 管理 pnpm，可以先执行：

```bash
corepack enable pnpm
```

## 安装

### 方式一：从 npm 安装（发布后）

```bash
dsh plugin --profile web add dsh-ai-prompt-optimizer
dsh web
```

### 方式二：从本地源码安装

```bash
git clone <你的仓库地址>
cd dsh-ai-prompt-optimizer
pnpm install
dsh plugin --profile web add .
dsh web
```

也可以在其他目录中直接指定仓库路径：

```bash
dsh plugin --profile web add /path/to/dsh-ai-prompt-optimizer
dsh web
```

### 方式三：从 GitHub 安装

```bash
dsh plugin --profile web add github:<owner>/<repo>
dsh web
```

如果 pnpm 阻止 Git 依赖执行构建脚本，请按终端提示，把对应 key 加入 DSH profile 目录下 `pnpm-workspace.yaml` 的 `allowBuilds`，然后重新执行安装命令。

## 使用方法

1. 打开 DSH Web 聊天页面；
2. 在输入框中写下原始需求，例如“帮我写一个周报”；
3. 点击发送按钮旁的 **“✨ AI 优化”**；
4. 等待优化完成；
5. 检查回填后的提示词，可以继续修改，确认后再发送。

> 注意：优化结果会替换当前输入框草稿。如果原文很重要，请先复制保存。

## 卸载

```bash
dsh plugin --profile web remove dsh-ai-prompt-optimizer
dsh web
```

## 常见问题

### 点击按钮后提示“当前没有可用的模型配置”

请先在 DSH 的模型设置中配置并选择一个可用模型，然后重试。

### 安装后没有看到按钮

请确认：

1. 插件安装到了 `web` profile；
2. 安装后已经重启 `dsh web`；
3. 当前页面是聊天会话页面；
4. 执行 `dsh --profile web --dump-config` 时能看到 `ai-prompt-optimizer`。

### 优化结果不理想

插件会尽量保留你的原始意图，但原始信息过少时，模型只能补充有限的结构。建议至少写清楚“要做什么、给谁看、希望输出什么形式”。

## 开发文档

面向插件开发者和维护者的技术文档位于 `docs/`：

- [技术方案设计](docs/technical-design.md)：本插件的功能拆解、架构、数据流、打包和安装设计；
- [如何开发 JavaScript 版本插件](docs/develop-js-plugin.md)：动态 JS 插件与可安装 JS 插件的开发方式；
- [如何开发 TypeScript 版本插件](docs/develop-ts-plugin.md)：可安装 TS/TSX 插件的完整工程化流程。

## 贡献

提交改动前请至少运行：

```bash
pnpm run typecheck
pnpm run pack:check
```

## License

[MIT](./LICENSE)
