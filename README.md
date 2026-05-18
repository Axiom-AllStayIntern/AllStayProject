# AllStay

酒店平板服务系统 — SvelteKit 全栈应用 + MCP Server 集群

**技术栈：** SvelteKit · TypeScript · Svelte Stores · Anthropic SDK · MCP · Redis · MySQL · Docker

---

## 目录

- [快速上手（前端开发）](#-快速上手前端开发)
- [完整本地环境](#-完整本地环境含-mcp-servers)
- [当前可以测试的内容](#-当前可以测试的内容)
- [暂时跳过的部分](#-暂时跳过的部分)
- [项目结构](#-项目结构)
- [环境变量说明](#️-环境变量说明)
- [Docker 一键启动](#-docker-一键启动)

---

## 🚀 快速上手（前端开发）

> **最低要求：** Node.js 20+，无需数据库，无需 Redis，无需 Docker

### 第一步：安装依赖

```bash
cd apps/tablet
npm install
```

### 第二步：配置环境变量

```bash
cp ../../.env.example .env
# 不需要填写任何值，留空即可先跑起来
```

### 第三步：启动开发服务器

```bash
npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)

### 可以立即看到什么

| 路由 | 内容 | 备注 |
|------|------|------|
| `/login` | 员工登录页（数字键盘） | 任意 Staff ID + 4-6位 PIN 可通过 |
| `/room-select` | 房间号输入 | 输入3-4位数字即可 |
| `/home` | 首页（4个功能入口） | 完全可用 |
| `/dining` | 餐饮分类列表 | 需要 MCP 连接（见下文 Mock） |
| `/spa` | SPA 服务列表 | 同上 |
| `/cart` | 购物车页面 | store 已实现，UI 完全可用 |
| `/amenities` | 酒店设施（静态数据） | **完全可用，无需 MCP** |
| `/explore` | 探索巴厘 Hub 页 | 完全可用 |

---

## 🔧 完整本地环境（含 MCP Servers）

### 前提条件

- Node.js 20+
- Docker Desktop（用于 Redis）
- 可选：MySQL（Cakrasoft PMS 数据库，Sprint 2 再接）

### 步骤

```bash
# 1. 在根目录安装所有 workspaces 依赖
npm install

# 2. 启动 Redis（仅需 Docker，不需要完整 compose）
docker run -d -p 6379:6379 redis:7-alpine

# 3. 配置环境变量
cp .env.example apps/tablet/.env
# 编辑 apps/tablet/.env，填写：
#   ANTHROPIC_API_KEY=sk-ant-...（AI 对话功能需要）
#   REDIS_URL=redis://localhost:6379

# 4. 启动 MCP Servers（每个新开一个终端）
cd apps/mcp-servers/packages/dining && npm install && npx ts-node src/index.ts
cd apps/mcp-servers/packages/spa    && npm install && npx ts-node src/index.ts
cd apps/mcp-servers/packages/restaurant && npm install && npx ts-node src/index.ts
cd apps/mcp-servers/packages/transport  && npm install && npx ts-node src/index.ts

# 5. 启动平板应用
cd apps/tablet && npm run dev
```

### MCP Server 健康检查

```bash
curl http://localhost:3001/health  # dining
curl http://localhost:3002/health  # spa
curl http://localhost:3003/health  # restaurant
curl http://localhost:3004/health  # transport
```

---

## ✅ 当前可以测试的内容

### 1. 登录 + 房间选择流程

访问 `/login` → 输入任意 Staff ID（如 `S001`）→ 输入任意4-6位 PIN → 自动跳转 `/room-select` → 输入房间号（如 `301`）→ 进入首页。

**验证点：**
- 数字键盘交互
- 路由守卫（直接访问 `/home` 会跳回 `/login`）
- RoomNumber 显示在 Header

### 2. 购物车 Store

在浏览器 Console 测试：

```javascript
// 打开开发者工具，进入 /cart 页面
// 购物车 store 会自动合并相同菜品

// 测试 API：
fetch('/api/cart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'add',
    roomId: '301',
    itemId: 'item-001',
    quantity: 2,
    specialInstructions: '少辣'
  })
}).then(r => r.json()).then(console.log)
```

### 3. AI 对话端点（需要 ANTHROPIC_API_KEY）

```bash
curl -X POST http://localhost:5173/api/conversation \
  -H "Content-Type: application/json" \
  -d '{
    "message": "帮我点一份炒饭，少辣",
    "roomId": "301",
    "language": "zh"
  }'
```

预期返回：
```json
{
  "reply": "已为您将炒饭（少辣）加入购物车...",
  "intent": "order"
}
```

### 4. 闲置屏保

进入任意页面后，打开 Console 执行：

```javascript
// 手动触发屏保（不用等5分钟）
import { idle } from '/src/lib/stores/idle.ts'
idle.triggerScreensaver?.()
```

或者修改 `src/lib/stores/idle.ts` 中的超时时间为 `10 * 1000`（10秒）测试。

### 5. 语言切换

点击 Header 右侧的 `EN / 中` 按钮，所有页面文本切换为中文。

---

## ⏭️ 暂时跳过的部分

这些功能框架已搭好，但需要真实数据源才能完整工作：

| 功能 | 状态 | 解锁条件 |
|------|------|---------|
| 菜单数据展示 | 框架就绪 | 连接 Cakrasoft PMS 数据库 |
| SPA 真实可用时段 | 框架就绪 | PMS 数据库 |
| 餐厅列表 | 框架就绪 | PMS 数据库 |
| 交通选项 | **有 Mock 数据** | 现在就能跑 |
| 订单打印 | 框架就绪 | 配置打印机 IP |
| Capacitor 持久化 | 框架就绪 | 打包为 Android APK |

---

## 📁 项目结构

```
allstay/
├── apps/
│   ├── tablet/               # SvelteKit 平板应用（前端 + BFF）
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── ai/       # AI 编排层（Orchestrator + Agents）
│   │       │   ├── components/  # 11个 UI 组件
│   │       │   └── stores/   # 5个 Svelte Stores
│   │       ├── routes/       # 页面 + API 端点
│   │       └── types/        # TypeScript 类型
│   │
│   └── mcp-servers/          # MCP Server 集群
│       └── packages/
│           ├── shared/       # 数据库 / Redis / 打印机
│           ├── dining/       # :3001 — 餐饮
│           ├── spa/          # :3002 — SPA
│           ├── restaurant/   # :3003 — 餐厅
│           └── transport/    # :3004 — 交通
│
├── packages/shared-types/    # 跨包类型定义
├── docs/architecture.md      # 架构图
├── docker-compose.yml        # 一键生产部署
└── scripts/
    ├── build.sh
    └── deploy.sh
```

---

## ⚙️ 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | AI 功能必填 | 从 console.anthropic.com 获取 |
| `AI_MODEL` | 否 | 默认 `claude-sonnet-4-6` |
| `MCP_DINING_URL` | 否 | 默认 `http://localhost:3001` |
| `MCP_SPA_URL` | 否 | 默认 `http://localhost:3002` |
| `MCP_RESTAURANT_URL` | 否 | 默认 `http://localhost:3003` |
| `MCP_TRANSPORT_URL` | 否 | 默认 `http://localhost:3004` |
| `REDIS_URL` | 购物车功能 | 默认 `redis://localhost:6379` |
| `DB_HOST/USER/PASSWORD` | PMS 数据 | Sprint 2 接入 |
| `SESSION_SECRET` | 生产必填 | 随机字符串，用于 cookie 签名 |
| `PRINTER_IP` | 打印功能 | 厨房打印机 IP |

---

## 🐳 Docker 一键启动

```bash
# 确保 .env 文件存在（从 .env.example 复制并填写）
cp .env.example .env

# 启动全部服务
docker compose up -d

# 查看日志
docker compose logs -f tablet
docker compose logs -f mcp-dining
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 开发工作流

参见 [github_workflow_guideline.md](./github_workflow_guideline.md)
