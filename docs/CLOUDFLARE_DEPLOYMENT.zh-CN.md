# Cloudflare Workers 部署

项目的生产部署由 `.github/workflows/deploy-cloudflare.yml` 完成。推送到
`main` 分支会自动部署，也可以在 GitHub 的 **Actions** 页面手动运行。

## 1. 创建 Cloudflare API Token

在 Cloudflare 控制台打开 **My Profile → API Tokens → Create Token**，使用
**Edit Cloudflare Workers** 模板，并将账户资源限制为要部署 AllStay 的个人账户。

不要把 Token 或 Account ID 写入代码、配置文件或提交记录。

## 2. 配置 GitHub Secrets

打开 GitHub 仓库：

**Settings → Environments → New environment → `production`**

在 `production` 环境中添加以下 Secrets：

| Secret | 内容 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | API Token；需要 Workers Scripts Edit 与 D1 Edit |
| `SPA_MCP_SHARED_TOKEN` | Tablet 与 Spa MCP 之间的随机共享密钥（不要复用 Cloudflare Token） |

也可以把它们配置为仓库级 Actions Secrets；工作流中的名称保持不变。

## 3. 首次部署

合并或推送到 `main`，或进入：

**Actions → Deploy to Cloudflare Workers → Run workflow**

工作流会按以下顺序部署：

1. 根据 `apps/spa-worker/wrangler.jsonc` 创建或更新 `allstay-spa-mcp` Worker；
2. 自动创建/绑定 `allstay-spa` D1，并应用预约表 migration；
3. 构建并部署 `allstay-tablet` Worker；
4. 将 Spa Worker 的部署 URL 和 `SPA_MCP_SHARED_TOKEN` 安全注入 Tablet。

部署成功后，GitHub Actions 日志会显示两个 `workers.dev` 地址。Spa 健康检查位于：

```text
https://allstay-spa-mcp.<你的 workers.dev 子域>/health
```

## 4. 配置应用运行时变量

部署凭据只负责发布 Worker。AI、MCP、会话等应用配置需要在 Cloudflare 控制台
的 **Workers & Pages → allstay-tablet → Settings → Variables and Secrets**
中单独设置。

至少按实际启用的功能配置：

- AI：`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`
- 会话：`SESSION_SECRET`、`STAFF_PIN_SALT`
- MCP：`MCP_DINING_URL`、`MCP_RESTAURANT_URL`、`MCP_TRANSPORT_URL`
- 可选本地化模型：`PHRASE_MODEL`、`SEALION_BASE_URL`、
  `SEALION_API_KEY`、`SEALION_MODEL`

API Key 和会话密钥应使用 **Secret** 类型。普通模型名、URL 和开关可以使用
**Text** 类型。

Spa MCP 已作为独立 Cloudflare Worker 部署，使用官方无状态 MCP handler，预约状态
持久化到 D1；其 `/api/mcp` 入口必须携带共享密钥。`MCP_SPA_URL` 与
`MCP_SPA_API_TOKEN` 由 GitHub Actions 自动注入，不需要在 Dashboard 手工维护。

Dining、Restaurant、Transport MCP 仍是 Node.js 服务，并可能依赖 Redis、MySQL 或
TCP 打印机；它们仍需部署到支持这些依赖的运行环境，再配置对应的 `MCP_*_URL`。

## 本地部署前验证

从仓库根目录运行：

```bash
npm ci
npm run build --workspace=apps/tablet
npx wrangler deploy --dry-run --config apps/tablet/wrangler.jsonc
```

`npm run check --workspace=apps/tablet` 目前仍会报告仓库中已有的 Svelte/TypeScript
诊断，因此暂未把它设为部署门槛；应在修复这些业务代码类型问题后再加入 CI。
