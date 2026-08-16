# 技术方案设计

本文描述 `dsh-ai-prompt-optimizer` 的插件架构、关键设计决策、仓库结构、官方插件包约定和构建发布流程。内容对齐 DeepSeek Harness `0.1.0-rc.6`。

## 1. 设计目标

该插件要解决的是“用户在发送前希望快速整理提示词”的问题，而不是创建一个独立的提示词管理器。因此设计目标是：

1. 入口必须贴近发送动作，放在聊天输入框右侧工具区；
2. 直接使用 DSH 当前默认模型，不引入第二套模型配置；
3. 优化结果只回填草稿，不自动发送；
4. Host 与 Client 的边界清晰，模型调用只发生在 Host；
5. 插件可以通过官方 `dsh plugin --profile web add …` 流程持久安装；
6. 构建产物满足 DSH Web 的浏览器模块加载协议。

## 2. 功能拆解

| 功能 | 所在平台 | 实现方式 |
|---|---|---|
| 读取当前草稿 | Client | 使用 `conversation.input.right` Slot 提供的 `input.draft` |
| 展示优化按钮 | Client | 向 `conversation.input.right` 注册 React 组件 |
| 调用模型 | Host | `agentDefaultModel.currentSelection()` 后调用 `llm.stream()` |
| Host / Client 通信 | Both | Typert Remote：`promptOptimizer/optimize` |
| 回填优化结果 | Client | 调用 `inputActions.setDraft()` |
| 展示错误 | Client | 向 `shell.overlay` 注册独立弹窗 |
| 随插件卸载清理 | Client | 返回 Remote 与 Slot 的 disposer |

## 3. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│ DSH Web Browser                                              │
│                                                              │
│ conversation.input.right                                     │
│   └─ PromptOptimizerButton                                   │
│        │ 1. 读取 input.draft                                  │
│        │ 2. remote.promptOptimizer.optimize({ draft })        │
│        ▼                                                     │
│ Typert Client Remote ───────────────┐                        │
└─────────────────────────────────────┼────────────────────────┘
                                      │ /api RPC
┌─────────────────────────────────────┼────────────────────────┐
│ DSH Host                            ▼                        │
│ Typert Gateway ──▶ PromptOptimizerService                   │
│                       │ 3. agentDefaultModel.currentSelection│
│                       │ 4. llm.stream(GenerateOptions)       │
│                       ▼                                      │
│                  LLM Provider                                │
└──────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Client 收到结果后调用 inputActions.setDraft(prompt)，用户确认后再发送。
```

## 4. 仓库结构

```text
dsh-ai-prompt-optimizer/
├── src/
│   ├── index.ts              # Host Cordis Service：模型调用和 Remote 方法
│   ├── remote.ts             # Client 挂载的 Remote descriptor 与 zod 校验
│   ├── typert.ts             # Host Typert manifest：注册 /api/promptOptimizer/optimize
│   ├── types.ts              # Host / Client 共享业务类型
│   └── client/
│       └── index.tsx         # 浏览器 Slot UI、样式和错误弹窗
├── scripts/
│   ├── clean.mjs             # 清理 lib/
│   └── wrap-client.mjs       # 包装为 DSH 浏览器模块格式
├── docs/
│   ├── technical-design.md
│   ├── develop-js-plugin.md
│   └── develop-ts-plugin.md
├── cordis.patch.yml          # 官方 bundle 安装层
├── tsdown.config.ts          # Client bundle 构建配置
├── tsconfig.build.json       # Host 编译配置
├── tsconfig.json             # 类型检查与声明生成配置
├── package.json
└── README.md
```

## 5. 官方插件包约定

### 5.1 Bundle 安装声明

`package.json` 中的：

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

表示该包是一个可加入 profile 的 bundle。`dsh plugin --profile web add …` 安装后，会把包名追加到 profile manifest 的 `dsh.profile.bundles`。

`cordis.patch.yml` 负责插入实际 Host 插件行：

```yaml
- insert:
    - id: ai-prompt-optimizer
      name: 'dsh-ai-prompt-optimizer'
```

### 5.2 Host 入口

```json
{
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    }
  }
}
```

`lib/index.js` 默认导出 `PromptOptimizerService`。Cordis Loader 会加载包根入口并创建该 Service。

### 5.3 Client 入口

```json
{
  "exports": {
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    }
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-conversation"
      ]
    }
  }
}
```

`dsh-client-modules` 扫描 Loader 中的包，发现 `dsh.client.platform: "web"` 后，把 `exports["./client"]` 加入浏览器启动图。

`dsh.client.inject` 写的是**包名**，用于浏览器模块依赖排序；Client 插件源码导出的 `inject = ['slots', 'remote']` 写的是**服务名**，用于 Cordis 激活等待。二者不要混淆。

### 5.4 Remote 类型和共享类型

- `exports["./remote"]`：Client 侧挂载 Remote namespace 时使用的 descriptor；
- `exports["./typert"]`：Host Typert Loader 发现的 `TYPERT` manifest，用来注册 `/api/promptOptimizer/optimize`；
- `exports["./types"]`：共享请求 / 结果类型；
- `files` 只发布 `lib/` 产物、安装 patch、README 和 LICENSE。

## 6. Host 设计

Host 端核心是 `PromptOptimizerService`：

```ts
export class PromptOptimizerService extends TypertRemoteService {
  static inject = ['llm', 'agentDefaultModel']

  constructor(ctx: Context) {
    super(ctx, 'promptOptimizer')
  }

  @Remote('optimize')
  async optimize(request: OptimizePromptRequest): Promise<OptimizePromptResult> {
    // 读取草稿、调用模型、返回业务结果
  }
}
```

关键决策：

1. **模型配置不重复维护**：只读取 `agentDefaultModel.currentSelection()`；
2. **请求字段保持最小化**：仅发送 `provider`、`model`、`system`、`messages`；
3. **不传递可选生成参数**：避免 Provider 因不支持 `temperature`、`maxTokens`、`reasoningEffort` 而拒绝请求；
4. **业务错误不外抛**：空草稿、无模型、空结果、模型失败都返回 `{ ok: false, error }`；
5. **请求来源可追踪**：消息使用 `createUserMessage()`，source 为 `{ kind: 'plugin', plugin: PACKAGE_NAME }`。

## 7. Remote 通信设计

Client 调用得到的是 Typert 的 `RemoteResult<T>` 外层信封：

```ts
type RemoteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }
```

业务结果本身也使用成功 / 失败联合类型：

```ts
type OptimizePromptResult =
  | { ok: true; prompt: string }
  | { ok: false; error: string }
```

因此 Client 分两层处理：

1. 外层 `carrier.ok === false`：RPC、挂载、网关或边界失败；
2. 内层 `carrier.value.ok === false`：提示词优化业务失败。

`src/remote.ts` 显式提供 Client 挂载所需的 descriptor，并用 zod 校验边界数据。`src/typert.ts` 再把同一组 descriptor 导出为 Host-face `TYPERT` manifest，并通过 `exports["./typert"]` 暴露给 `@deepseek-ai/dsh-typert-loader`。这样 `/api/promptOptimizer/optimize` 会由 Host Typert Registry / Gateway 显式注册，而不是只依赖 `@Remote` 源码标记。对外部安装或本地链接安装的包，这个 manifest 是必要产物：装饰器标记保存在 Typert Protocol 模块的私有 `WeakMap` 中，如果插件解析到与 DSH Gateway 不同的模块副本，Gateway 无法看到源码标记，路径就会返回 404。

一个容易踩到的 Cordis 限制是：同一个 Client 插件在 `apply()` 中刚执行完 `ctx.remote.$mount(...)`，不能直接读取 `ctx.remote.promptOptimizer`。这个带点的属性会被 Guard 视为未声明的 `remote.promptOptimizer` 服务依赖，而它又不可能同时作为本插件启动前的硬依赖。因此当前实现使用 `ctx.get('remote.promptOptimizer')` 读取刚挂载的 namespace。只有当 namespace 已由其他 assembly 插件预先挂载时，才适合声明 `inject: ['remote.promptOptimizer']` 并使用属性访问。

## 8. Client UI 设计

### 8.1 输入框按钮

按钮注册到：

```text
conversation.input.right
```

选择该 Slot 的原因是：

- 它位于发送按钮前，符合“发送前优化”的用户路径；
- 它是 list 型 Slot，新插件使用自己的 `id`，不会覆盖已有入口；
- 它提供 `input` 快照和 `inputActions`，不需要额外查询会话状态。

### 8.2 错误弹窗

错误弹窗注册到：

```text
shell.overlay
```

该 Slot 是全局浮层，适合展示模型不可用、调用失败等必须让用户感知的信息。弹窗状态由 Client 内部的小型 store 管理。

### 8.3 样式

样式在 Client 插件激活时插入 `<style data-plugin-css="dsh-ai-prompt-optimizer/client.css">`，颜色优先使用 DSH 主题变量，避免硬编码主题色。

## 9. 构建与发布设计

完整构建由以下步骤组成：

```text
clean
  └─ tsc -p tsconfig.build.json       # 编译 Host、Remote、Typert manifest 和共享类型入口
  └─ tsdown                           # 打包浏览器 Client
  └─ scripts/wrap-client.mjs          # 包装 window.__ModuleLoader__.load(...)
  └─ tsc --emitDeclarationOnly        # 生成 lib/types/**/*.d.ts
```

### 9.1 为什么 Host 使用 `tsc`

`@Remote('optimize')` 是 TypeScript 标准装饰器。当前构建中必须把它降级为 Node.js 可执行的初始化代码；直接让 tsdown 输出 Host 文件会保留装饰器语法，导致 Node.js 无法解析。因此 Host 使用 `tsc -p tsconfig.build.json` 输出。

### 9.2 为什么 Client 使用 tsdown

DSH Web 插件的浏览器产物需要：

- 把 TSX 编译为 React 调用；
- 将 `zod` 等运行时依赖内联，避免浏览器模块表无法解析；
- 保持 `react` 和 `react/jsx-runtime` 外部化，复用 DSH 页面中的实例；
- 输出为 `window.__ModuleLoader__.load({ id, factory })` 形式。

tsdown 负责打包，`scripts/wrap-client.mjs` 负责加上 DSH 模块注册包装。

### 9.3 Git / npm 安装

- `prepare`：源码安装或 Git 依赖安装时自动构建；
- `prepack`：`npm pack` / 发布前自动构建；
- `files`：限制发布内容只包含可运行产物和必要文档。

## 10. 生命周期与清理

Client `apply()` 返回异步 disposer：

1. 清空当前 Remote namespace 引用；
2. 逆序移除 Slot 注册；
3. 卸载 Remote contribution。

这保证插件被 HMR、停用或移除时，不会留下旧按钮、旧弹窗或旧 Remote 方法。

## 11. 兼容性与边界

当前实现对齐：

- DSH `0.1.0-rc.6`
- Cordis `^4.0.1`
- React `^18.2.0`

依赖的 DSH 能力：

- Host：`llm`、`agentDefaultModel`、Typert Gateway；
- Client：`slots`、`remote`、`conversation.input.right`、`shell.overlay`。

该插件不持久保存用户草稿，不新增模型配置，也不把提示词发送到 DSH 当前 Provider 之外的服务。

## 12. 验证清单

提交或发布前至少执行：

```bash
pnpm run typecheck
pnpm run build
pnpm run pack:check
```

还可以用隔离 profile 验证官方安装流程：

```bash
dsh plugin --profile web add .
dsh --profile web --dump-config
```

确认输出中存在 `ai-prompt-optimizer`。

新增或修改 Host / Client 接口后，按 [接口端到端验证手册](./e2e-verification.md) 在隔离 `DSH_HOME` 和独立端口中验证，不要直接使用正在运行的用户 Web 实例。

## 13. 后续可扩展方向

- 优化前自动备份原始草稿，支持一键恢复；
- 提供“简洁版 / 结构化版 / 英文版”等优化策略；
- 将系统提示词做成插件配置项；
- 增加优化耗时和模型名称提示；
- 支持快捷键触发；
- 在设置页提供开关和默认策略。
