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
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 API Token |

也可以把它们配置为仓库级 Actions Secrets；工作流中的名称保持不变。

## 3. 首次部署

合并或推送到 `main`，或进入：

**Actions → Deploy to Cloudflare Workers → Run workflow**

Wrangler 会根据 `apps/tablet/wrangler.jsonc` 创建或更新名为
`allstay-tablet` 的 Worker。部署成功后，GitHub Actions 日志会显示
`workers.dev` 地址。

## 4. 配置应用运行时变量

部署凭据只负责发布 Worker。AI、MCP、会话等应用配置需要在 Cloudflare 控制台
的 **Workers & Pages → allstay-tablet → Settings → Variables and Secrets**
中单独设置。

至少按实际启用的功能配置：

- AI：`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`
- 会话：`SESSION_SECRET`、`STAFF_PIN_SALT`
- MCP：`MCP_DINING_URL`、`MCP_SPA_URL`、`MCP_RESTAURANT_URL`、
  `MCP_TRANSPORT_URL`
- 可选本地化模型：`PHRASE_MODEL`、`SEALION_BASE_URL`、
  `SEALION_API_KEY`、`SEALION_MODEL`

API Key 和会话密钥应使用 **Secret** 类型。普通模型名、URL 和开关可以使用
**Text** 类型。

当前仓库中的四个 MCP 服务仍是 Node.js 服务，并依赖 Redis/MySQL 或 TCP
打印机；本工作流只部署 SvelteKit tablet Worker。需要将 MCP 服务部署到可公开
访问且支持 Node.js TCP 依赖的运行环境，再把上面的 `MCP_*_URL` 指向它们。
在完成这一步前，基础界面可用，但依赖 MCP、数据库或打印机的功能不会完整工作。

## 本地部署前验证

从仓库根目录运行：

```bash
npm ci
npm run build --workspace=apps/tablet
npx wrangler deploy --dry-run --config apps/tablet/wrangler.jsonc
```

`npm run check --workspace=apps/tablet` 目前仍会报告仓库中已有的 Svelte/TypeScript
诊断，因此暂未把它设为部署门槛；应在修复这些业务代码类型问题后再加入 CI。
