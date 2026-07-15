# AllStay

酒店平板服务系统，使用 SvelteKit 和 TypeScript 构建。

这份 README 面向“新设备刚从 GitHub clone 项目”的场景。请先按快速启动跑通 tablet 前端和本地 MCP 服务。

语言：[English](./README.md) | 中文

---

## 当前启动状态

| 路径 | 状态 | 现在是否推荐 |
| --- | --- | --- |
| Tablet 前端 / SvelteKit app | 本地可启动 | 推荐 |
| 根目录 `npm run dev` | 会同时启动 tablet + MCP 服务 | 推荐 |
| MCP servers | workspace package 已配置 | 推荐 |
| Docker Compose | 已存在，但生产构建路径仍需单独验证 | 后续可选 |

如果只是最快速检查 UI，也可以只启动 `apps/tablet`。正常本地开发推荐使用根目录 `npm run dev`。

---

## 环境要求

- Node.js 20 或更新版本
- npm，随 Node.js 一起安装
- Git

后续可选：

- Docker Desktop，用于 Redis / Docker Compose
- MySQL，用于未来 PMS 集成
- Anthropic API key，仅 AI 对话功能需要
- OpenAI API key，仅语音识别 / 语音合成功能需要

---

## 新设备快速启动

### 1. Clone 并进入项目

```bash
git clone <your-repo-url>
cd AllStayProject
```

如果你的目录名不同，进入实际 clone 出来的目录即可。

### 2. 安装依赖

在仓库根目录执行：

```bash
npm install
```

这会安装 workspace 依赖，包括 `apps/tablet`。

### 3. 创建 tablet 环境变量文件

macOS / Linux / Git Bash：

```bash
cp .env.example apps/tablet/.env
```

Windows PowerShell：

```powershell
Copy-Item .env.example apps/tablet/.env
```

首次只测前端时，可以先保留模板里的占位值。AI、语音、Redis、打印机、PMS 数据库功能后续才需要真实配置。

### 4. 启动完整本地开发环境

在仓库根目录执行：

```bash
npm run dev
```

这会启动：

| 服务 | URL |
| --- | --- |
| Tablet app | `http://localhost:5173/login` |
| Dining MCP | `http://127.0.0.1:3001/health` |
| SPA MCP | `http://127.0.0.1:3002/health` |
| Restaurant MCP | `http://127.0.0.1:3003/health` |
| Transport MCP | `http://127.0.0.1:3004/health` |

浏览器打开：

```text
http://localhost:5173/login
```

### 只启动 UI

如果你只想启动 tablet，不启动 MCP 服务：

```bash
npm run dev --workspace=apps/tablet -- --host 127.0.0.1
```

也可以进入 tablet 目录执行：

```bash
cd apps/tablet
npm run dev -- --host 127.0.0.1
```

---

## 首次手动测试

1. 打开 `http://localhost:5173/login`
2. Staff ID 随便填，例如 `S001`
3. PIN 填任意 4-6 位数字，例如 `1234`
4. 应跳转到 `/room-select`
5. 房号填任意 3-4 位数字，例如 `301`
6. 应进入 `/home`

不依赖 MCP / Redis / 数据库、应该可以直接测试的页面：

| 路由 | 预期结果 |
| --- | --- |
| `/login` | 员工登录页 |
| `/room-select` | 房号输入页 |
| `/home` | 平板首页 |
| `/cart` | 购物车 UI 和本地流程 |
| `/amenities` | 静态酒店设施 |
| `/explore` | 探索页入口 |

这些页面可以调用 MCP，但根据具体操作可能仍需要 Redis/MySQL 数据：

| 路由 | 原因 |
| --- | --- |
| `/dining` | Dining MCP 已可启动；真实菜单数据需要 PMS 数据库 |
| `/spa` | SPA MCP 已可启动；部分数据当前是 mock |
| `/restaurants` | Restaurant MCP 已可启动；真实餐厅数据需要 PMS 数据库 |
| `/explore/transport` | Transport MCP 已可启动，并有 mock options |

---

## 常用测试命令

### 类型检查

```bash
npm run check --workspace=apps/tablet
```

### 构建 tablet 生产包

```bash
npm run build --workspace=apps/tablet
```

### 预览生产包

```bash
npm run preview --workspace=apps/tablet
```

---

## 环境变量

模板文件是 `.env.example`。本地开发 tablet 时，把它复制到 `apps/tablet/.env`。

| 变量 | 用途 | 说明 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI 对话接口 | 基础 UI 测试不需要 |
| `AI_MODEL` | AI 对话接口 | 代码里有默认值 |
| `OPENAI_API_KEY` | 语音识别和语音合成 | 基础 UI 测试不需要 |
| `MCP_DINING_URL` | Dining MCP 调用 | 默认 `http://localhost:3001` |
| `MCP_SPA_URL` | SPA MCP 调用 | 默认 `http://localhost:3002` |
| `MCP_RESTAURANT_URL` | Restaurant MCP 调用 | 默认 `http://localhost:3003` |
| `MCP_TRANSPORT_URL` | Transport MCP 调用 | 默认 `http://localhost:3004` |
| `REDIS_URL` | Redis 相关流程 | 默认 `redis://localhost:6379` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PMS 数据库集成 | 当前本地路径尚未完整接入 |
| `PRINTER_IP`, `PRINTER_PORT` | 打印机集成 | 可选 |
| `SESSION_SECRET`, `STAFF_PIN_SALT` | Auth/session 加固 | 生产风格部署需要 |

不要提交真实 `.env` 文件或 API key。

---

## 常见问题

### 5173 端口被占用

停止旧的 dev server，或者换端口启动：

```bash
npm run dev --workspace=apps/tablet -- --host 127.0.0.1 --port 5174
```

然后打开 `http://127.0.0.1:5174/login`。

### 根目录 `npm run dev` 卡住或失败

先检查 `5173`、`3001`、`3002`、`3003`、`3004` 是否已有旧 dev server 占用。停止旧进程后重试：

```bash
npm run dev
```

如果你只需要先调 UI，可以使用：

```bash
npm run dev --workspace=apps/tablet -- --host 127.0.0.1
```

### Docker 启动失败

请先使用本地 `npm run dev`。Docker Compose 文件已存在，但生产 Docker 路径还需要单独验证后再作为部署依据。

---

## 项目结构

```text
AllStayProject/
  apps/
    tablet/               # SvelteKit 平板应用
      src/
        lib/
        routes/
        types/
    mcp-servers/          # MCP server workspace
      packages/
        dining/
        spa/
        restaurant/
        transport/
        shared/
  packages/
    shared-types/
  docs/
  scripts/
  docker-compose.yml
  package.json
  .env.example
```

---

## 开发流程

见 [github_workflow_guideline.md](./github_workflow_guideline.md)。
