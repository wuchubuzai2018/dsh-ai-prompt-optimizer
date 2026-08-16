# DSH 插件接口端到端验证手册

本文给后续开发者或 AI Agent 使用：当插件新增、修改或排查 Host / Client 接口时，按本文在**隔离 DSH 环境**中完成端到端验证。不要直接重启、覆盖或探测用户正在使用的 DSH Web 实例。

## 1. 什么时候必须执行

以下改动都需要执行本文流程：

- 新增或删除 Typert Remote 方法；
- 修改 Remote `namespace`、`method`、`service` 或参数结构；
- 修改 `src/index.ts` 的 Host Service；
- 修改 `src/remote.ts` 的 Client descriptor；
- 修改 `src/typert.ts` 的 Host manifest；
- 修改 `package.json` 的 `exports["./remote"]`、`exports["./typert"]` 或 `dsh.client`；
- 修改 `cordis.patch.yml`；
- 用户报告按钮可用但调用失败，例如 `/api/... HTTP 404`、参数校验失败或返回结构异常。

## 2. 基本原则

1. **使用隔离 `DSH_HOME`**：例如 `/tmp/dsh-plugin-e2e`，不要使用用户默认的 `~/.dsh`；
2. **使用独立端口**：例如 `3081`，不要占用用户当前的 `3080`；
3. **后台启动临时 Web 进程**：记录进程或 Job，验证结束后必须停止；
4. **先证明 Host 路由存在，再验证业务逻辑**：`HTTP 404` 表示路径没有注册，不要误判为模型调用失败；
5. **真实模型调用可选**：空参数或边界参数足以验证路由、参数和业务返回结构；只有用户明确要求时才调用真实模型；
6. **保留证据**：记录 HTTP 状态码和响应体，最终报告必须说明验证前后结果。

## 3. 接口路径约定

Typert Remote 的浏览器路径由以下字段共同决定：

```text
/api/<namespace>/<method>
```

本插件当前路径是：

```text
/api/promptOptimizer/optimize
```

对应源码：

- `src/remote.ts`：`namespace: 'promptOptimizer'`、`method: 'optimize'`；
- `src/typert.ts`：把同一 descriptor 暴露为 Host `TYPERT` manifest；
- `src/index.ts`：`PromptOptimizerService` 注册 `promptOptimizer` Service，并实现 `optimize()`。

浏览器 Remote 调用不会直接发送裸参数，而是发送完整 RPC envelope：

```json
{
  "type": "client-request",
  "rpcId": "probe-id",
  "method": "promptOptimizer/optimize",
  "payload": {
    "args": {
      "request": {
        "draft": ""
      }
    }
  }
}
```

其中 `payload.args` 的 key 必须等于 descriptor 中每个参数的 `wire` 字段。本插件的请求参数声明为：

```ts
{
  name: 'request',
  wire: 'request',
  source: 'json'
}
```

因此必须包一层 `request`，不能直接写成 `{ "draft": "..." }`。

## 4. 标准验证流程

### 4.1 构建和类型检查

在插件仓库根目录执行：

```bash
pnpm run typecheck
pnpm run build
pnpm run pack:check
```

如果环境没有直接暴露 `pnpm`，使用：

```bash
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm run pack:check
```

### 4.2 静态检查 Host manifest

确认 `lib/typert.js` 可以被 Node.js 直接导入，并且包名、Host face、endpoint 和 strict codec 正确：

```bash
node --input-type=module - <<'EOF'
import { TYPERT } from './lib/typert.js'

const descriptor = TYPERT.invocations[0]
if (TYPERT.package !== 'dsh-ai-prompt-optimizer') throw new Error('invalid package')
if (TYPERT.face !== 'host') throw new Error('invalid face')
if (descriptor?.namespace !== 'promptOptimizer') throw new Error('invalid namespace')
if (descriptor?.method !== 'optimize') throw new Error('invalid method')
if (descriptor?.parameters?.[0]?.codec?.mode !== 'strict') throw new Error('invalid request codec')
if (descriptor?.result?.mode !== 'strict') throw new Error('invalid result codec')

console.log(`Typert Host manifest OK: ${descriptor.namespace}/${descriptor.method}`)
EOF
```

期望输出：

```text
Typert Host manifest OK: promptOptimizer/optimize
```

### 4.3 创建隔离 profile 并安装插件

```bash
E2E_HOME=/tmp/dsh-prompt-optimizer-e2e
rm -rf "$E2E_HOME"
mkdir -p "$E2E_HOME"

DSH_HOME="$E2E_HOME" \
  dsh plugin --profile web add /Users/longyu/data/develop/vibecoding/dsh-ai-prompt-optimizer

DSH_HOME="$E2E_HOME" \
  dsh --profile web --dump-config | grep -A3 'ai-prompt-optimizer'
```

期望看到：

```yaml
# == dsh-ai-prompt-optimizer
- id: ai-prompt-optimizer
  name: dsh-ai-prompt-optimizer
```

### 4.4 启动隔离 Web 服务

使用独立端口启动：

```bash
DSH_HOME=/tmp/dsh-prompt-optimizer-e2e \
  dsh --profile web --host 127.0.0.1 --port 3081
```

由 AI Agent 执行时应使用托管后台任务，并记录任务 ID。看到如下输出后才能继续：

```text
dsh web: http://127.0.0.1:3081
```

### 4.5 确认 Host 插件处于 active

先调用内置 `pluginInventory/list`，确认本插件的 Loader 行已激活：

```bash
curl -sS \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"probe-plugin-inventory","method":"pluginInventory/list","payload":{"args":{}}}' \
  http://127.0.0.1:3081/api/pluginInventory/list \
  > /tmp/dsh-plugin-inventory.json

node --input-type=module - <<'EOF'
import fs from 'node:fs'

const body = JSON.parse(fs.readFileSync('/tmp/dsh-plugin-inventory.json', 'utf8'))
const entries = body.result?.value?.entries ?? []
const entry = entries.find((item) => item.moduleName === 'dsh-ai-prompt-optimizer')
if (!entry) throw new Error('plugin entry not found')
console.log(entry)
if (entry.enabled !== true || entry.fiberPhase !== 'active') {
  throw new Error('plugin entry is not active')
}
EOF
```

期望类似：

```text
{
  entryId: 'include:ai-prompt-optimizer',
  moduleName: 'dsh-ai-prompt-optimizer',
  enabled: true,
  fiberPhase: 'active'
}
```

### 4.6 验证目标 Remote 路由

用空草稿验证路径、参数和业务返回结构。空草稿不会触发真实模型调用，Host 会直接返回业务错误：

```bash
curl -sS \
  -o /tmp/dsh-prompt-optimizer-response.json \
  -w 'status=%{http_code}\n' \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"probe-optimize-route","method":"promptOptimizer/optimize","payload":{"args":{"request":{"draft":""}}}}' \
  http://127.0.0.1:3081/api/promptOptimizer/optimize

cat /tmp/dsh-prompt-optimizer-response.json
```

期望：

```text
status=200
```

响应体类似：

```json
{
  "type": "server-response",
  "rpcId": "probe-optimize-route",
  "result": {
    "ok": true,
    "value": {
      "ok": false,
      "error": "请先输入需要优化的提示词。"
    }
  }
}
```

这里的内层 `value.ok: false` 不是失败：它证明路由存在、Host 方法已执行、业务结果结构符合约定。

### 4.7 结果判断

| 结果 | 含义 | 下一步 |
|---|---|---|
| HTTP 404 | Host 没有注册 `/api/<namespace>/<method>` | 检查 `./typert` export、`TYPERT` manifest、Loader 行是否 active |
| HTTP 200 且 `result.ok: true` | 网关已分发，Host 方法已执行 | 继续检查 `result.value` 的业务结果 |
| HTTP 200 且 `result.ok: false` | RPC 或边界处理失败 | 查看 `result.error.message` 和 `details` |
| HTTP 200 且 `result.value.ok: false` | 业务方法正常返回业务失败 | 对空草稿等预期失败场景视为验证通过 |
| HTTP 400 / 415 | 请求 envelope 或 Content-Type 错误 | 对照本文第 3 节修正请求体 |
| HTTP 403 | 请求来源未通过 Host trust fence | 确认使用 `127.0.0.1` 和正确端口 |

### 4.8 停止临时服务并清理

验证结束后必须停止临时 Web 服务：

```bash
kill <临时 Web 进程 PID>
```

AI Agent 使用托管后台任务时，应调用对应任务停止能力，并在最终回复前确认任务已结束。

确认不再需要后可以删除：

```bash
rm -rf /tmp/dsh-prompt-optimizer-e2e
```

## 5. 可复用命令模板

新增其他 Remote 接口时，把 `NAMESPACE`、`METHOD` 和 `ARGS_JSON` 替换为新接口的值：

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=/Users/longyu/data/develop/vibecoding/dsh-ai-prompt-optimizer
PLUGIN_ID=ai-prompt-optimizer
PACKAGE_NAME=dsh-ai-prompt-optimizer
NAMESPACE=promptOptimizer
METHOD=optimize
ARGS_JSON='{"request":{"draft":""}}'
E2E_HOME=/tmp/dsh-plugin-e2e
PORT=3081
ENDPOINT="$NAMESPACE/$METHOD"

cd "$PROJECT_ROOT"
pnpm run typecheck
pnpm run build

rm -rf "$E2E_HOME"
mkdir -p "$E2E_HOME"
DSH_HOME="$E2E_HOME" dsh plugin --profile web add "$PROJECT_ROOT"
DSH_HOME="$E2E_HOME" dsh --profile web --dump-config | grep -A3 "$PLUGIN_ID"

DSH_HOME="$E2E_HOME" dsh --profile web --host 127.0.0.1 --port "$PORT" \
  >"$E2E_HOME/web.log" 2>&1 &
WEB_PID=$!
trap 'kill "$WEB_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT" >/dev/null 2>&1; then break; fi
  sleep 1
done

REQUEST_BODY=$(ARGS_JSON="$ARGS_JSON" ENDPOINT="$ENDPOINT" node --input-type=module - <<'EOF'
const args = JSON.parse(process.env.ARGS_JSON)
console.log(JSON.stringify({
  type: 'client-request',
  rpcId: `probe-${Date.now()}`,
  method: process.env.ENDPOINT,
  payload: { args },
}))
EOF
)

STATUS=$(curl -sS \
  -o "$E2E_HOME/response.json" \
  -w '%{http_code}' \
  -H 'content-type: application/json' \
  -d "$REQUEST_BODY" \
  "http://127.0.0.1:$PORT/api/$ENDPOINT")

printf 'status=%s\n' "$STATUS"
cat "$E2E_HOME/response.json"
printf '\n'

if [ "$STATUS" = '404' ]; then
  echo "Host route is missing: /api/$ENDPOINT" >&2
  exit 1
fi
```

## 6. 浏览器侧补充验证

当接口涉及 UI 时，还需要验证浏览器模块：

```bash
curl -fsS \
  http://127.0.0.1:3081/plugins/dsh-ai-prompt-optimizer/client.js \
  | head -c 300
```

确认返回的是 JavaScript，并包含：

```js
window.__ModuleLoader__.load({
  id: "dsh-ai-prompt-optimizer"
```

随后打开隔离地址：

```text
http://127.0.0.1:3081
```

检查：

1. 页面没有插件加载错误；
2. 输入框出现插件按钮；
3. 空草稿点击按钮时展示业务错误，而不是 HTTP 404；
4. 有可用模型时，输入草稿后点击按钮能回填结果。

## 7. 新接口开发验收清单

- [ ] `src/remote.ts` 新增 Client descriptor；
- [ ] `src/typert.ts` 的 `TYPERT.invocations` 包含同一 descriptor；
- [ ] `src/index.ts` 的 Host Service 实现同名业务方法；
- [ ] `namespace`、`method`、`service`、参数 `wire` 全部一致；
- [ ] `package.json` 暴露 `./remote` 和 `./typert`；
- [ ] `files` 包含对应 `lib/*.js`；
- [ ] `pnpm run typecheck` 通过；
- [ ] `pnpm run build` 通过；
- [ ] `pnpm run pack:check` 通过；
- [ ] 隔离 profile 安装成功；
- [ ] `pluginInventory/list` 显示插件 `active`；
- [ ] `/api/<namespace>/<method>` 不再返回 404；
- [ ] 临时 Web 服务已停止；
- [ ] 最终报告写明 HTTP 状态码和关键响应体。
