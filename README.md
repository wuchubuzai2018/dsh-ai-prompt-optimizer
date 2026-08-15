# dsh-ai-prompt-optimizer

一个适用于 DeepSeek Harness（DSH）的动态 Cordis 插件，在聊天输入框发送按钮前增加 **“✨ AI 优化”** 按钮。

## 功能

- 读取聊天输入框中的当前草稿；
- 使用 DSH 当前配置的模型调用 `llm.stream()`；
- 将模型返回的优化提示词写回输入框，但不会自动发送；
- 请求期间按钮显示“优化中…”；
- 优化成功后不显示额外状态文案；
- 输入为空或模型调用失败时，通过独立弹窗显示错误；
- 不传递 `temperature`、`maxTokens`、`reasoningEffort` 等可能不被部分 Provider 支持的可选字段。

## 仓库结构

```text
dsh-ai-prompt-optimizer/
├── src/
│   ├── host.js      # Host 端模型调用和私有 RPC
│   └── client.js    # 输入框按钮、草稿回填和错误弹窗
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## DSH 动态包源码

`src/host.js` 和 `src/client.js` 是可直接传给 `cordis_define` 的普通 JavaScript **函数体**，不是独立的 Node.js 入口文件。它们使用 DSH 动态插件运行时提供的对象：

- Host：`ctx`、`harness`
- Client：`ctx`、`host`、`React`、`styles`

代码不使用 TypeScript、JSX、`import`、`require` 或未经 Cordis Inspect 确认的浏览器全局对象。

创建动态插件时使用以下信息：

```text
name: dsh-ai-prompt-optimizer
idPrefix: prompt
host source: src/host.js
client source: src/client.js
```

当前开发会话中的动态实例是 `prompt-1`，但该 ID 是 DSH 在创建插件实例时分配的运行时 ID，并不是开源项目名称。其他用户创建插件后可能获得不同的 `pluginId`；仓库和插件包名称始终是 `dsh-ai-prompt-optimizer`。

## 工作原理

1. Client 向 `conversation.input.right` Slot 注册优化按钮；
2. 点击按钮后，通过 Package 私有 RPC 调用 Host 的 `optimize-prompt`；
3. Host 读取 `agentDefaultModel.currentSelection()`；
4. Host 使用选中的 `provider` 和 `model` 调用 `llm.stream()`；
5. Client 收到结果后调用 `inputActions.setDraft()` 回填输入框；
6. 错误通过 `shell.overlay` Slot 中的弹窗呈现。

## 模型请求兼容性

模型请求仅携带以下字段：

- `provider`
- `model`
- `system`
- `messages`

这样可以避免部分 Provider 因不支持 `temperature`、`maxTokens` 或 `reasoningEffort` 等可选字段而拒绝请求。

## 安装和使用

本项目当前提供的是 DSH 动态 Cordis Package 源码。使用前需要在目标 DSH 运行时中：

1. 查询并确认 `llm`、`agentDefaultModel`、`conversation.input.right` 和 `shell.overlay` 的实际接口；
2. 使用 `src/host.js` 和 `src/client.js` 创建名为 `dsh-ai-prompt-optimizer` 的动态插件；
3. 激活生成的 Package，并在 DSH 页面完成 Client Package 授权；
4. 在聊天输入框中输入原始提示词，然后点击 **“✨ AI 优化”**。

> 动态 Cordis 插件属于当前 DSH 进程。DSH 进程重启后，动态实例可能不再存在，需要重新定义或通过持久化的 DSH 插件/组合方式安装。

## 发布到 GitHub

在项目工作区执行：

```bash
cd dsh-ai-prompt-optimizer
git init
git add .
git commit -m "feat: initial dsh-ai-prompt-optimizer plugin"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

## License

[MIT](./LICENSE)
