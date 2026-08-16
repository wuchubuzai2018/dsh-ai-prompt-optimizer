# 发布策略：为什么本仓库将 lib 构建产物提交进 Git

本文说明本仓库在 npm 发布与 Git 提交上的策略选择：**lib 构建产物既会打进 npm tarball，也会提交进 Git 仓库**，以及这样做的原因和需要注意的事项。内容对齐 `package.json` 当前的配置。

## 1. 两个容易混淆的概念

讨论"要不要带 lib"时，需要先区分两个层面：

| 层面 | 由什么决定 | 本仓库的选择 |
|---|---|---|
| npm 发布的 tarball 里是否包含 lib | `package.json` 的 `files` 白名单 | **包含**（必须） |
| Git 仓库里是否提交 lib | `.gitignore` 是否忽略 | **包含**（主动选择） |

### 1.1 npm tarball 必须包含 lib

`package.json` 中的两个关键配置：

- `files` 白名单（第 33-42 行）明确列出了 `lib/index.js`、`lib/client.js`、`lib/remote.js`、`lib/types/**/*.d.ts` 等——发布时**只有这些文件会被打进 tarball**，`src/`、`docs/` 都不会被发布；
- `main` 和 `exports` 全部指向 `lib/*.js`——用户安装后实际加载的就是 lib 产物。

因此 **lib 必须存在于发布的 tarball 中，否则包安装后无法加载**。这不是可选项。

### 1.2 Git 是否提交 lib 是可选的

即使 Git 里不提交 lib，发布也不会出问题，因为 `package.json` 里有两个自动构建钩子：

```json
"prepack": "npm run build",    // npm publish / npm pack 时自动构建
"prepare": "npm run build"     // 本地 install、从 Git 安装时自动构建
```

执行 `npm publish` 时，npm 会先跑 `prepack` 现场构建出 lib 再打包上传。"Git 不提交产物 + 发布时自动构建"是社区中大多数库的标准做法。

## 2. 本仓库为什么选择提交 lib

本仓库的 `.gitignore` **没有**忽略 lib，这是主动选择，主要原因：

1. **GitHub 直装路径更稳**。README 安装方式三（`dsh plugin add github:<owner>/<repo>`）依赖 pnpm 从 Git 安装并执行 `prepare` 构建。pnpm 默认可能阻止 Git 依赖的构建脚本，要求用户手动在 `pnpm-workspace.yaml` 的 `allowBuilds` 中加白名单。**lib 已提交时，即使构建脚本被拦截，包也直接可用**，用户少踩一个坑。
2. **源码安装零等待**。用户克隆后执行 `dsh plugin --profile web add .` 时无需先跑完整构建。
3. **产物可审查**。发布内容即仓库内容，方便 review 和回溯历史版本的实际产物。

## 3. 代价与注意事项

提交构建产物的主要风险是**源码与产物不同步**：改了 `src/` 忘了重新 build 就提交，Git 里的 lib 就是旧版本，排查问题会非常迷惑。

因此维护时必须遵守：

1. **提交前重新构建**：

   ```bash
   pnpm run build
   ```

2. **提交时同时包含 `src/` 与 `lib/` 的变更**，不要让两者分散在不同提交中（除非是纯构建产物同步提交）。

3. **发布前验证 tarball 内容**：

   ```bash
   pnpm run pack:check   # 即 npm pack --dry-run
   ```

   确认 `lib/` 下的 js 与 `.d.ts` 都在文件列表中。

4. （可选）如果后续协作人数变多，可以考虑加 pre-commit 钩子（如 husky + lint-staged）在提交前自动执行构建，避免人工遗漏。

## 4. 常见疑问速查

**Q：只发布 npm，还需要提交 lib 吗？**
不需要，`prepack` 会在发布时自动构建。本仓库提交 lib 主要是为了 GitHub 直装路径的稳定性。

**Q：npm tarball 里会有 `src/` 吗？**
不会。`files` 白名单不包含它，最终用户拿到的只有 lib 产物、`cordis.patch.yml`、README 和 LICENSE。

**Q：怎么验证当前发布内容是否正确？**
本地执行 `pnpm run build && pnpm run pack:check`，检查 dry-run 输出的文件清单和包大小；也可以 `npm pack` 生成 tgz 后解开检查。
