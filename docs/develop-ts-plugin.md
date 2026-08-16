# 如何开发 TypeScript 版本的 DSH 插件

本文以本仓库为参考，说明如何创建一个可长期安装、可打包发布、同时包含 Host 与 Web Client 的 TypeScript DSH 插件。内容对齐 DSH `0.1.0-rc.6`。

## 1. 什么时候选择 TypeScript

以下情况建议直接使用 TypeScript / TSX：

- 插件需要长期安装，而不是临时动态调试；
- 需要自定义 Host→Client RPC；
- 需要 Typert Remote 类型合并和边界校验；
- 需要复杂 React UI；
- 需要发布 npm 包并提供 `.d.ts`；
- 多人协作或后续会持续维护。

## 2. 推荐目录

```text
my-ts-plugin/
├── src/
│   ├── index.ts              # Host 插件入口
│   ├── remote.ts             # Client 挂载的 Remote contribution
│   ├── typert.ts             # Host Typert manifest，用于注册 /api/<namespace>/<method>
│   ├── types.ts              # 共享类型
│   └── client/
│       └── index.tsx         # 浏览器插件入口
├── scripts/
│   ├── clean.mjs
│   └── wrap-client.mjs
├── cordis.patch.yml
├── tsdown.config.ts
├── tsconfig.build.json
├── tsconfig.json
└── package.json
```

## 3. package.json 必备字段

### 3.1 ESM、入口和类型

```json
{
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./remote": {
      "types": "./lib/types/remote.d.ts",
      "default": "./lib/remote.js"
    },
    "./typert": {
      "types": "./lib/types/typert.d.ts",
      "default": "./lib/typert.js"
    },
    "./types": {
      "types": "./lib/types/types.d.ts",
      "default": "./lib/types.js"
    },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  }
}
```

### 3.2 DSH bundle 与 Client 声明

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
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

注意：

- `dsh.bundle.patch` 决定 `dsh plugin add` 是否把它作为 profile 层激活；
- `dsh.client.platform: "web"` 决定它是否进入浏览器启动图；
- `dsh.client.inject` 填**包名**；
- Client `apply` 导出的 `inject` 填**Cordis 服务名**。

### 3.3 files

```json
{
  "files": [
    "lib/index.js",
    "lib/client.js",
    "lib/remote.js",
    "lib/typert.js",
    "lib/types.js",
    "lib/types/**/*.d.ts",
    "lib/types/**/*.d.ts.map",
    "cordis.patch.yml",
    "README.md",
    "LICENSE"
  ]
}
```

`lib/` 应加入 `.gitignore`，由 `prepare` / `prepack` 自动构建。

### 3.4 构建脚本

本仓库使用：

```json
{
  "scripts": {
    "clean": "node scripts/clean.mjs",
    "bundle": "tsc -p tsconfig.build.json && tsdown",
    "types": "tsc --emitDeclarationOnly --declaration --declarationMap --outDir lib/types",
    "build": "node scripts/clean.mjs && npm run bundle && node scripts/wrap-client.mjs && npm run types",
    "typecheck": "tsc --noEmit",
    "pack:check": "npm pack --dry-run",
    "prepack": "npm run build",
    "prepare": "npm run build"
  }
}
```

`prepare` 支持 Git 依赖安装；`prepack` 支持 npm 包发布前构建。

## 4. cordis.patch.yml

```yaml
- insert:
    - id: my-ts-plugin
      name: 'my-ts-plugin'
```

`name` 必须等于包名。`id` 是 Cordis Loader 行 ID，用于后续 patch 覆盖或调试。

## 5. Host 插件

### 5.1 共享类型

```ts
// src/types.ts
export interface OptimizePromptRequest {
  readonly draft: string
}

export type OptimizePromptResult =
  | { readonly ok: true; readonly prompt: string }
  | { readonly ok: false; readonly error: string }
```

### 5.2 Typert Host Service

```ts
// src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { createUserMessage, type GenerateOptions } from '@deepseek-ai/dsh-llm'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { OptimizePromptRequest, OptimizePromptResult } from './types'

export class PromptOptimizerService extends TypertRemoteService {
  static inject = ['llm', 'agentDefaultModel']

  constructor(ctx: Context) {
    super(ctx, 'promptOptimizer')
  }

  @Remote('optimize')
  async optimize(request: OptimizePromptRequest): Promise<OptimizePromptResult> {
    const draft = request.draft.trim()
    if (!draft) return { ok: false, error: '请先输入需要优化的提示词。' }

    const selection = this.ctx.agentDefaultModel.currentSelection()
    const options: GenerateOptions = {
      provider: selection.provider,
      model: selection.model,
      system: '你是资深提示词工程师……',
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: draft }],
          source: { kind: 'plugin', plugin: 'my-ts-plugin' },
        }),
      ],
    }

    let text = ''
    for await (const chunk of this.ctx.llm.stream(options)) {
      if (chunk.type === 'text-delta') text += chunk.text
    }

    return { ok: true, prompt: text.trim() }
  }
}

export default PromptOptimizerService
```

关键点：

- `static inject` 声明 Host 服务依赖；
- `super(ctx, 'promptOptimizer')` 同时注册 Cordis Service 和 Remote namespace；
- `@Remote('optimize')` 暴露 `promptOptimizer/optimize`；
- `createUserMessage()` 会创建带合法 MessageId 的消息，避免手写字段。

## 6. Remote contribution

Client 不会自动知道一个新的 Host namespace。插件需要提供 contribution 并在浏览器端挂载。

```ts
// src/remote.ts
import { z } from 'zod'
import type {
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol'
import type { OptimizePromptRequest, OptimizePromptResult } from './types'

const requestSchema = z.object({ draft: z.string() }).readonly()
const resultSchema = z.union([
  z.object({ ok: z.literal(true), prompt: z.string() }).readonly(),
  z.object({ ok: z.literal(false), error: z.string() }).readonly(),
]).readonly()

interface PromptOptimizerRemoteNamespace {
  optimize(
    request: OptimizePromptRequest,
  ): Promise<RemoteResult<OptimizePromptResult>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'promptOptimizer/optimize': PromptOptimizerRemoteNamespace['optimize']
  }

  interface TypertRemoteNamespaceMap {
    promptOptimizer: PromptOptimizerRemoteNamespace
  }
}

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: 'my-ts-plugin',
  descriptors: [
    {
      id: 'my-ts-plugin#promptOptimizer/optimize',
      service: 'promptOptimizer',
      namespace: 'promptOptimizer',
      method: 'optimize',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'request',
          wire: 'request',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'my-ts-plugin/types#OptimizePromptRequest',
            schema: requestSchema,
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: 'my-ts-plugin/types#OptimizePromptResult',
        schema: resultSchema,
      },
    },
  ],
}

export default TYPERT_REMOTE
```

### 6.1 Host Typert manifest

只写 `@Remote` 不足以保证外部安装包中的 HTTP 路径一定存在。`@Remote` 标记保存在 Typert Protocol 模块的私有 `WeakMap` 中；本地链接安装时，插件源码目录可能解析到自己的 `node_modules/@deepseek-ai/dsh-typert-protocol`，而 DSH Gateway 使用另一份模块，导致 Gateway 看不到标记并返回 404。

因此可安装 TS 插件应再导出 `./typert` Host manifest，让 `dsh-typert-loader` 显式注册同一路径：

```ts
// src/typert.ts
import { TYPERT_REMOTE } from './remote.js'

export const TYPERT = {
  package: 'my-ts-plugin',
  face: 'host',
  schemas: [],
  invocations: TYPERT_REMOTE.descriptors,
  model: {
    services: [
      {
        description: 'Optimize one composer draft.',
        summary: 'Prompt optimizer Host service.',
        tags: [],
        key: 'promptOptimizer',
        exportName: 'PromptOptimizerService',
        members: [
          {
            kind: 'method',
            name: 'optimize',
            signature: "@Remote('optimize') optimize(request: OptimizePromptRequest): Promise<OptimizePromptResult>",
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
} as const
```

注意相对导入写 `./remote.js`，不要写 `./remote`。当前项目使用 `"module": "ESNext"`，TypeScript 会把源码里的 `.js` 后缀映射到 `.ts`，同时 Node.js 加载 `lib/typert.js` 时也能找到真实文件。

Client 得到的是：

```ts
RemoteResult<OptimizePromptResult>
```

所以需要分别处理：

1. RPC 外层失败：`carrier.ok === false`；
2. 业务内层失败：`carrier.value.ok === false`。

## 7. Client TSX 插件

```tsx
// src/client/index.tsx
import React from 'react'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import TYPERT_REMOTE from '../remote'

type PromptOptimizerRemote = ClientContext['remote']['promptOptimizer']

export const inject = ['slots', 'remote']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  // 本插件刚挂载的 dotted namespace 不能通过 ctx.remote.promptOptimizer
  // 直接读取；那会触发 Cordis 的未声明依赖检查。这里使用可选 Service 读取。
  const promptOptimizer = ctx.get('remote.promptOptimizer') as PromptOptimizerRemote | undefined
  if (promptOptimizer === undefined) {
    await disposeRemote()
    throw new Error('prompt optimizer Remote namespace was not installed')
  }

  const disposeButton = ctx.slots.inject('conversation.input.right', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.right',
        id: 'prompt-optimizer',
        order: 10,
        label: 'AI 优化提示词',
      },
      (props) => {
        const onClick = async () => {
          const result = await promptOptimizer.optimize({
            draft: props.input.draft,
          })
          if (result.ok && result.value.ok) {
            props.inputActions.setDraft(result.value.prompt)
          }
        }
        return <button type="button" onClick={onClick}>✨ AI 优化</button>
      },
    ),
  )

  return async () => {
    disposeButton()
    await disposeRemote()
  }
}
```

实际项目还应处理：

- 空草稿；
- 请求中状态；
- 外层 RPC 错误；
- 内层业务错误；
- 多个 Slot 的逆序清理；
- Slot 尚不存在时的 `slots.inject()` 等待。

## 8. 构建配置

### 8.1 类型检查配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "useDefineForClassFields": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

### 8.2 Host 编译配置

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib",
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false,
    "noEmit": false
  },
  "include": [
    "src/index.ts",
    "src/remote.ts",
    "src/typert.ts",
    "src/types.ts"
  ]
}
```

Host 使用 `tsc` 的原因是：Typert 装饰器必须降级为 Node.js 可执行代码。若构建器原样保留 `@Remote`，Node.js 会在加载插件时报语法错误。

### 8.3 Client 打包配置

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    client: 'src/client/index.tsx',
  },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  entryFileNames: '[name].js',
  outExtensions: () => ({ js: '.js' }),
  external: ['react', 'react/jsx-runtime'],
  noExternal: ['zod'],
  sourcemap: false,
  dts: false,
  clean: false,
})
```

- `react` 必须外部化，复用 DSH 页面中的 React；
- `zod` 应内联到 Client bundle，浏览器模块表默认不知道如何解析它；
- 输出文件必须叫 `client.js`，与 `exports["./client"]` 一致。

### 8.4 DSH 浏览器模块包装

最终 `lib/client.js` 必须具有如下外形：

```js
window.__ModuleLoader__.load({
  id: 'my-ts-plugin',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    // tsdown 输出的 CJS 内容

    return module.exports
  },
})
```

本仓库使用 `scripts/wrap-client.mjs` 在 tsdown 之后添加这层包装。

## 9. 安装与验证

### 9.1 本地验证

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run pack:check
```

### 9.2 安装到隔离或真实 profile

```bash
dsh plugin --profile web add /path/to/my-ts-plugin
dsh --profile web --dump-config
dsh web
```

确认：

- profile `package.json` 的 dependencies 包含插件；
- `dsh.profile.bundles` 包含插件包名；
- dump 结果包含插件行 ID；
- 浏览器能访问 `/plugins/<package-name>/client.js`。

## 10. 常见坑

### 10.1 Node.js 报装饰器语法错误

现象：

```text
SyntaxError: Invalid or unexpected token
@Remote("optimize")
```

原因：构建器保留了 `@Remote` 语法。解决：Host 使用 `tsc` 降级后再发布。

### 10.2 浏览器报 `require("zod") missed the module table`

原因：Client bundle 外部化了 zod。解决：在 tsdown 中设置 `noExternal: ['zod']`。

### 10.3 Client 一直等待服务

检查源码导出的服务名：

```ts
export const inject = ['slots', 'remote']
```

而不是包名。包名写在 `package.json` 的 `dsh.client.inject`。

### 10.4 报 `cannot get property "remote.xxx" without inject`

在同一个插件的 `apply()` 中先执行 `ctx.remote.$mount(...)`，再直接读取 `ctx.remote.xxx`，会触发 Cordis 的未声明依赖检查。因为该 namespace 是本插件刚刚挂载的，不能同时把它作为启动前的 `inject` 硬依赖。

解决：挂载后用可选 Service 读取：

```ts
const remoteNamespace = ctx.get('remote.xxx')
```

如果 namespace 已由另一个 Remote assembly 插件预先挂载，才可以在当前插件中声明 `inject: ['remote.xxx']` 并使用 `ctx.remote.xxx`。

### 10.5 点击按钮报 `/api/<namespace>/<method>` HTTP 404

Client 请求路径存在，不代表 Host 已注册该路径。可安装插件必须同时发布：

1. `exports["./remote"]` 给 Client 挂载 namespace；
2. `exports["./typert"]` 给 Host Typert Loader 注册 HTTP endpoint。

如果只依赖 `@Remote` 源码标记，本地链接安装时可能因为插件和 DSH Gateway 解析到不同的 `@deepseek-ai/dsh-typert-protocol` 模块副本而看不到标记，最终返回 404。

### 10.6 忘记解包 RemoteResult

Typert Remote 返回的是 `{ ok, value | error }` 外层信封；业务结果还应继续判断自己的 `ok` 字段。

### 10.7 包名不一致

以下位置必须保持一致：

- `package.json` 的 `name`；
- `cordis.patch.yml` 的 `name`；
- Remote contribution 的 `package`；
- Host `TYPERT` manifest 的 `package`；
- Client wrapper 的 `id`；
- README 中的安装命令。

### 10.8 Git 安装没有构建产物

确保：

- `lib/` 不提交但由 `prepare` 生成；
- `prepack` 可以构建 npm 包；
- pnpm 的 `allowBuilds` 允许该 Git 包运行构建脚本。

## 11. 推荐验收清单

- [ ] `pnpm run typecheck` 通过；
- [ ] `pnpm run build` 通过；
- [ ] `node --check lib/index.js` 通过；
- [ ] `node --check lib/client.js` 通过；
- [ ] Host 默认导出可以被 `import()`；
- [ ] Host `./typert` manifest 可以被 `import()`，且 `package` / `face` / endpoint 正确；
- [ ] Client bundle 注册了正确的 `window.__ModuleLoader__` ID；
- [ ] `npm pack --dry-run` 只包含必要文件；
- [ ] 隔离 profile 中 `dsh plugin --profile web add .` 成功；
- [ ] `dsh --profile web --dump-config` 能看到插件行；
- [ ] 页面刷新后按钮或 UI 正常出现；
- [ ] 按 [接口端到端验证手册](./e2e-verification.md) 验证 `/api/<namespace>/<method>` 不返回 404。
