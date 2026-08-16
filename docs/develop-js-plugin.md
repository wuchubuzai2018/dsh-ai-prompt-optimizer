# 如何开发 JavaScript 版本的 DSH 插件

“JS 插件”在 DSH 中通常有两种含义：

1. **动态 Cordis 插件**：把普通 JavaScript 函数体交给当前 DSH 进程临时运行，适合原型验证；
2. **可安装 JS 插件包**：作为 npm/file/Git 依赖安装到 profile，适合长期分发。

选择前请先判断插件的生命周期：只在当前调试会话中使用，选动态插件；需要重启后仍存在，选可安装插件包。

## 1. 动态 JS 插件

动态插件由 `cordis_define` 接收 `code.host` 和 `code.client`。它们都是**普通 JavaScript 函数体**，不是完整模块。

### 1.1 适用场景

- 快速验证一个 Slot、Service 或模型调用；
- 临时给当前页面添加按钮、弹窗或 Tool；
- 调试 Host / Client 数据流；
- 不打算在 DSH 重启后继续保留。

### 1.2 运行环境约束

动态函数体不会经过 TypeScript、JSX 或打包器处理，因此不能使用：

- `import` / `require`；
- TypeScript 类型；
- JSX；
- 未确认的浏览器或 Node 全局对象。

Host 可用对象通常包括：

- `ctx`；
- `harness`。

Client 可用对象通常包括：

- `ctx`；
- `host`；
- `React`；
- `styles`。

开始使用前应先通过 Cordis Inspect 确认 Service、Slot、Builtin 和参数结构。

### 1.3 Host 示例

```js
return {
  inject: ['llm', 'agentDefaultModel'],
  apply(ctx) {
    harness.handle('summarize-draft', async (args) => {
      const draft = args && typeof args.draft === 'string' ? args.draft.trim() : ''
      if (!draft) return { ok: false, error: '请先输入内容。' }

      const selection = ctx.agentDefaultModel.currentSelection()
      // 调用 ctx.llm.stream(...) 并返回可 JSON 序列化的数据
      return { ok: true, draft, provider: selection.provider, model: selection.model }
    })
  },
}
```

要点：

- `inject` 声明硬依赖后，才能使用 `ctx.llm` 这种属性访问；
- 可选 Service 使用 `ctx.get('name')`，并处理 `undefined`；
- 返回值必须是 lossless JSON，不要返回 Service、Context、函数或类实例。

### 1.4 Client 示例

```js
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`
      .my-plugin-button {
        height: 32px;
        padding: 0 10px;
      }
    `)

    slots.inject('conversation.input.right', () =>
      slots.register(
        {
          name: 'conversation.input.right',
          id: 'my-js-plugin',
          order: 10,
          label: '我的插件',
        },
        () => React.createElement(
          'button',
          { type: 'button', className: 'my-plugin-button' },
          '执行',
        ),
      ),
    )
  },
}
```

要点：

- Client React 必须使用 `React.createElement(...)`；
- UI 必须注册到已查询过的 Slot；
- `slots.inject()` 和 `slots.register()` 的返回值由 Cordis 生命周期接管；
- 不要在模块外创建无法释放的全局副作用。

### 1.5 Client 调 Host

动态插件可以使用 Package 私有 RPC：

```js
// Host
return {
  apply(ctx) {
    harness.handle('get-state', async (args) => ({ value: args.key }))
  },
}
```

```js
// Client
return {
  async apply(ctx) {
    const result = await host.call('get-state', { key: 'demo' })
    console.log(result.value)
  },
}
```

该通道只接受 JSON。不要传递 React Element、Cordis Context、Service 实例或函数。

### 1.6 动态插件的限制

- 定义只存在于当前 DSH 进程；
- 重启后需要重新定义；
- Client Package 首次运行可能需要页面授权；
- 不适合直接作为长期安装形态；
- 代码不能复用 npm 依赖，除非运行环境已经显式提供。

## 2. 可安装 JS 插件包

可安装插件包需要满足与普通 npm 包不同的两组约定：

1. DSH profile bundle 约定；
2. DSH Web Client bundle 约定。

### 2.1 最小目录

```text
my-js-plugin/
├── src/
│   ├── index.js          # Host 入口，可直接以 ESM 发布
│   └── client.entry.js   # Client 源码，仍需打包成 DSH 浏览器模块
├── lib/
│   └── client.js         # 构建产物；最终形式见 2.5
├── cordis.patch.yml
└── package.json
```

### 2.2 package.json

```json
{
  "name": "my-js-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./client": "./lib/client.js",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": [
    "src/index.js",
    "lib/client.js",
    "cordis.patch.yml",
    "README.md",
    "LICENSE"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime"
      ]
    }
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1"
  }
}
```

### 2.3 cordis.patch.yml

```yaml
- insert:
    - id: my-js-plugin
      name: 'my-js-plugin'
```

`name` 必须等于 `package.json` 的 `name`。

### 2.4 Host 插件

纯 Host 或无 UI 插件可以直接导出 `apply`：

```js
export function apply(ctx) {
  const llm = ctx.get('llm')
  if (llm === undefined) return

  // 注册 Host 能力、监听 Event 或提供 Service
}
```

也可以使用 Cordis Service 类。若需要暴露给浏览器调用，通常会引入 Typert Remote；Remote 装饰器在 JS 中没有标准语法支持，因此自定义 Host→Client RPC 更推荐直接使用 TypeScript。纯 JS 更适合：

- 只消费现有 Host Service；
- 只注册 Host Tool；
- 只做浏览器 UI，并调用已有 Remote namespace；
- 不需要自定义模型 RPC 的插件。

### 2.5 Client bundle 格式

DSH Web 不是直接执行普通 ESM。可安装 Client 包最终必须注册为：

```js
window.__ModuleLoader__.load({
  id: 'my-js-plugin',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    exports.inject = ['slots']
    exports.apply = function apply(ctx) {
      return ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'my-js-plugin-overlay',
            order: 100,
          },
          () => null,
        ),
      )
    }

    return module.exports
  },
})
```

上面的形式是可以直接由 DSH Web 加载的最终产物。更常见的做法是保留一个普通 ESM 源文件：

```js
// src/client.entry.js
export const inject = ['slots']

export function apply(ctx) {
  return ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'my-js-plugin-overlay',
        order: 100,
      },
      () => null,
    ),
  )
}
```

然后用 tsdown / Rolldown 打包成 CJS，再添加 `window.__ModuleLoader__.load(...)` 包装。也就是说：

- `src/client.entry.js` 是源码，可以使用 `export`；
- `lib/client.js` 是最终产物，必须使用 `exports.*` 并被模块工厂包装；
- `package.json` 的 `exports["./client"]` 指向最终产物，而不是未包装源码。

这里的 `inject` 是 Cordis **服务名**；`package.json` 中 `dsh.client.inject` 是**包名**。

## 3. 安装与验证

本地安装：

```bash
dsh plugin --profile web add /path/to/my-js-plugin
dsh web
```

检查 bundle 是否激活：

```bash
dsh --profile web --dump-config
```

卸载：

```bash
dsh plugin --profile web remove my-js-plugin
```

## 4. JS 与 TS 如何选择

| 需求 | 建议 |
|---|---|
| 临时验证一个想法 | 动态 JS 插件 |
| 页面小按钮、简单 overlay | 动态 JS 或小型可安装 JS 包 |
| 需要长期安装和分发 | 可安装插件包 |
| 需要自定义 Host→Client RPC | 优先 TypeScript |
| 需要完整类型、声明文件和重构能力 | TypeScript |
| 需要复杂 React UI | TypeScript + TSX |
| 需要使用 Typert Remote 装饰器 | TypeScript |

## 5. 常见问题

### 动态插件为什么不能用 `import`？

动态 `code.host` / `code.client` 是直接求值的函数体，不经过模块加载器。需要复用依赖时，应改用可安装插件包。

### 为什么 Client 代码执行了但没有 UI？

先确认：

1. `dsh.client.platform` 是 `web`；
2. `exports["./client"]` 存在；
3. bundle 调用了 `window.__ModuleLoader__.load`；
4. 插件行已经进入 Cordis Loader；
5. Slot 名称、scope、注册参数来自实时 Inspect 结果。

### 为什么重启后动态插件消失？

动态插件是进程内定义，不是持久化安装。需要重启后保留时，请改为包含 `dsh.bundle.patch` 的可安装插件包。

### 纯 JS 是否一定不能做 Host→Client RPC？

不是绝对不能，但 Typert Remote 的声明式写法依赖 TypeScript 装饰器与类型合并。对于新项目，直接使用 TypeScript 会更简单、可维护，也能生成 `.d.ts`。
