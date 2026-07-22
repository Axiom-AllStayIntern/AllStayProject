# AllStay 技术分析文档

> 本文基于对仓库源码（分支 `feature/aki-realtime-stream`）的逐层阅读整理，而非复述 README。凡是"看得见的事实"都关联到具体文件/函数；凡是"推断"都标注了依据。文档中若指出与 README 不符之处，以**代码实现**为准。

---

## 1. 项目定位与真实需求

AllStay 是一套**面向巴厘岛度假酒店的客房平板服务系统**。真实使用者是"住在客房里的客人"和背后的酒店运营方，要解决的核心痛点是：

- 客人在房间里想点餐、订 SPA、订餐厅、叫车、问酒店信息时，不想打前台电话、不想下 App、也可能有语言障碍（中/英/印尼混住）。
- 酒店希望把这些"客房增值服务"的下单动线搬到房间里的平板上，并且尽量自动化，减少前台人力。

围绕这个需求，项目做了两件在代码上都能坐实的事：

1. **触屏点单动线**：`apps/tablet` 是一个 SvelteKit 应用，提供 `/dining`、`/spa`、`/restaurants`、`/explore/transport` 等页面，让客人用手指浏览、加购物车、结算（[apps/tablet/src/routes](apps/tablet/src/routes)）。
2. **常驻语音助理动线**：一个"随时能唤醒说话"的语音管家（[VoiceAssistant.svelte](apps/tablet/src/lib/components/VoiceAssistant.svelte)），客人说一句话就能完成点餐/问询/预约。这是本项目**含金量最高、也是当前主力开发的部分**（分支名即 `realtime-stream`）。

后端不是传统的单体 API，而是按业务域拆成 **4 个 MCP（Model Context Protocol）服务**：dining / spa / restaurant / transport（[apps/mcp-servers/packages](apps/mcp-servers/packages)）。这个选型本身就透露了设计意图——**让业务能力以"AI 可调用的工具"的形式暴露**，而不仅是给前端调的 REST 接口。

**复杂度评估（诚实版）**：这个项目的业务逻辑本身不复杂（点餐、订 SPA 都是常规的"查目录 → 选时段 → 下单"），真正有含金量、值得展开讲的是**语音对话链路 + AI 编排 + MCP 工具化**这一块。餐厅/交通/信息（FAQ）等域仍停留在骨架或静态数据阶段。所以本文会把笔墨集中在 AI/语音/SPA 三条线上，其余如实说明其"占位/未完成"状态，不强行拔高。

**与 README 的关系**：README 的"Known limitations"表格有**多处已被代码超越（即代码已经比 README 说的更完整）**，本文第 7/9 节会逐条点出，这类"文档滞后于实现"的地方恰恰是面试里能讲的迭代故事。

---

## 2. 核心用户流程 / 业务流程

### 流程 A：语音点餐（含 AI 意图识别 + 流式回复）——本项目主线

从客人开口到平板回话，完整链路如下（每一步都能在代码里找到落点）：

1. **唤醒**：`WakeDetector` 用浏览器 `webkitSpeechRecognition` 持续监听，命中正则 `\bstart(...)?\b` 即唤醒（[wake-detector.ts](apps/tablet/src/lib/utils/wake-detector.ts)）。
2. **录音 + 停顿检测**：进入 `listening` 态，`MediaRecorder` 录音，`attachSilenceVAD` 用 `AnalyserNode` 算 RMS，"说完话 + 静默 1.5s"就触发结束（[silence-vad.ts](apps/tablet/src/lib/utils/silence-vad.ts)）。
3. **STT**：音频 blob POST 到 `/api/stt`，走 OpenAI `whisper-1`（`verbose_json`，自动语种检测），返回 `{ text, detected }`（[api/stt/+server.ts](apps/tablet/src/routes/api/stt/+server.ts)）。
4. **对话（SSE 流式）**：`processVoiceInput` 把文本 + 房间号 + 历史 POST 到 `/api/conversation`，服务端 `streamConversation()` 调 Claude，边生成边把 `reply` 字段**逐字**通过 SSE 推回前端（[ai-conversation.ts](apps/tablet/src/lib/services/ai-conversation.ts) + [orchestrator.ts](apps/tablet/src/lib/ai/orchestrator.ts)）。
5. **意图分发**：Claude 返回 `{intent, entities, reply}`，`dispatchParsed()` 按 `intent` 路由到 order/booking/info/spa 等域 Agent，Agent 通过 JSON-RPC 调对应 MCP 服务（[orchestrator.ts:102](apps/tablet/src/lib/ai/orchestrator.ts)）。
6. **TTS + 导航**：`reply` 交给 `/api/tts`（OpenAI `tts-1` / voice `nova`）整段合成播放；同时 `AIResponse.action` 可能带 `navigate`，把用户带到对应页面（如点餐 → `/dining?tag=...`）（[tts.ts](apps/tablet/src/lib/utils/tts.ts) + [ai-conversation.ts:114](apps/tablet/src/lib/services/ai-conversation.ts)）。

> 经过的关键模块：`VoiceAssistant.svelte`（状态机）→ `ai-conversation.ts`（客户端编排）→ `api/stt`、`api/conversation`、`api/tts`（BFF）→ `orchestrator.ts` + `agents/*`（AI 编排）→ `mcp-client.ts` → 各 MCP 服务。

### 流程 B：语音订 SPA（多轮 + 确认门）

这是全项目**唯一实现了"多轮上下文 + 显式确认"**的业务流程，值得单独拎出来：

1. 客人问"推荐个 SPA" → `spa_info` 意图 → `runSpaConcierge()` 跑一个**真实的 Agentic 工具循环**（调 `list_spa_services` / `get_spa_service` 等只读工具），产出有数据支撑的推荐，并记住"最后推荐的疗程"到 `spaSession`（[spa-agent.ts:94](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。
2. 客人说"就订这个，明天下午三点" → `booking_spa` → `proposeSpaBooking()` 校验时段可用性，**只提议、不落单**，把 proposal 标记为 `awaitingConfirmation`（[booking-agent.ts:52](apps/tablet/src/lib/ai/agents/booking-agent.ts) + [spa-session.ts](apps/tablet/src/lib/ai/spa-session.ts)）。
3. 客人说"确认" → `confirm_booking` → 校验有待确认项后才调 `create_spa_booking` 真正下单，成功后清空 pending（[orchestrator.ts:185](apps/tablet/src/lib/ai/orchestrator.ts)）。

### 流程 C：触屏点餐/订 SPA（不经过 AI）

`/dining`、`/spa` 等页面各自有 `+page.server.ts` 提供数据、`+page.svelte` 做 UI，购物车走 `/api/cart` → dining MCP → Redis。**注意**：`/spa` 触屏页用的是它自己 `+page.server.ts` 里**硬编码的另一套服务目录和时段**（`sp-bali`、`TIME_SLOTS=['10:00','11:30',...]`），与语音链路走的 MCP 目录（`balinese-massage`、`BASE_TIMES=['09:00',...]`）**是两套互不相通的数据**（详见第 9 节技术债）。

---

## 3. 总体技术架构

```
┌───────────────────────────────────────────────────────────────┐
│                     apps/tablet  (SvelteKit)                    │
│                                                                 │
│  路由页面 (+page.svelte)         语音助理 (VoiceAssistant)      │
│        │                              │                         │
│        │  表单/交互                    │ 录音/VAD/唤醒            │
│        ▼                              ▼                         │
│  ┌──────────────── BFF: src/routes/api/* ─────────────────┐    │
│  │  /stt  /tts   /conversation(SSE)   /cart /menu /spa ... │    │
│  └───────┬───────────────┬──────────────────────┬─────────┘    │
│          │               │                      │              │
│     OpenAI          AI 编排层 lib/ai/*        mcp-client        │
│  (whisper/tts)   orchestrator + agents + cultural              │
│                        │                      │                │
└────────────────────────┼──────────────────────┼───────────────┘
      Anthropic Claude ◀──┘        JSON-RPC 2.0 / HTTP │
                                                       ▼
        ┌──────────┬──────────┬──────────────┬──────────────┐
        │ dining   │  spa     │ restaurant   │ transport    │
        │ MCP:3001 │ MCP:3002 │ MCP:3003     │ MCP:3004     │
        └────┬─────┴────┬─────┴──────┬───────┴──────┬───────┘
             │          │            │              │
        Redis(cart)  SpaRepo     (MySQL 查询/占位)  (mock)
        ESC/POS 打印  mock/db 可切换
             │
        Cakrasoft PMS (MySQL, 多为 TODO/占位)
```

**分层与职责**（部分为推断，依据：目录划分 + 依赖 + 命名）：

- **UI 层**（`routes/*/+page.svelte`、`lib/components`）：触屏页面与语音助理组件，纯前端交互与状态机。
- **BFF 层**（`routes/api/*`）：SvelteKit server routes 充当 Backend-for-Frontend，**客户端从不直接访问 MCP**，所有 MCP/AI 调用都由服务端代理（[docs/architecture.md](docs/architecture.md) 明确点出，代码中 `mcp-client.ts` 也只在 server 侧被引用）。
- **AI 编排层**（`lib/ai`）：orchestrator（意图分类 + 分发）、agents（域内逻辑）、cultural（文化优化）、tools/mcp-client（MCP 客户端）、spa-session（会话状态）。
- **MCP 服务层**（`apps/mcp-servers/packages/*`）：每个域一个独立 Express + MCP Server 进程，无状态，状态外置到 Redis / PMS。
- **共享层**（`packages/shared-types`、`mcp-servers/packages/shared`）：跨包类型与基础设施（DB 连接池、Redis、打印机）。

**关键架构判断**：

- **MCP 作为后端接口协议**是最独特的选型。业务能力不是普通 REST，而是包装成 `tools/call`（JSON-RPC 2.0），这样同一套工具既能被前端 BFF 调（[api/spa/+server.ts](apps/tablet/src/routes/api/spa/+server.ts) 直接调 `check_spa_availability`），也能被 AI Agent 当工具调（[spa-agent.ts](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。**"给人用的接口"和"给 AI 用的工具"在这里是同一套**。
- **AI 暂时内嵌在 SvelteKit 里**（[docs/architecture.md](docs/architecture.md) 说 Phase 4 才抽出成独立 orchestrator 服务；仓库里 `apps/ai-orchestrator` 目前只有一个 README）。

---

## 4. 关键模块分析

只挑真正承载核心价值的模块，不做逐文件流水账。

### 4.1 `orchestrator.ts` —— AI 意图编排中枢

- **职责**：把一句自然语言变成"结构化意图 + 实体 + 回复"，再分发到域 Agent。
- **关键实现**：用 Anthropic 的**强制工具调用**（`tool_choice: {type:'tool', name:'respond'}`）拿到 schema 化输出（`RESPOND_TOOL`，[orchestrator.ts:252](apps/tablet/src/lib/ai/orchestrator.ts)）；`dispatchParsed()` 是一个大 `switch`，每个 intent 对应一段编排逻辑。
- **对外暴露**：`processConversation()`（一次性）与 `streamConversation()`（流式）。
- **依赖**：`@anthropic-ai/sdk`、各 agents、`spa-session`。

### 4.2 `spa-agent.ts` —— 带 RAG 与文化约束的 Agentic 循环

- **职责**：教模型"如何用 SPA 只读工具查真实数据并给出有据可依的推荐"。
- **关键实现**：`runSpaConcierge()` 是一个 `MAX_HOPS=4` 的工具循环——模型 `stop_reason==='tool_use'` 时执行工具、回填 `tool_result`、继续下一跳，直到给出文本答案（[spa-agent.ts:116](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。system prompt 由 4 段拼成：技能说明 + 语言 + 文化 register + 检索到的文化事实。
- **另一半**：`resolveSpaServiceId()` 是一个**不调 LLM 的确定性解析器**，把"巴厘按摩/Balinese massage"打分匹配到目录 id（含中文 2-gram、英文分词、id/全名强信号），用于预约链路省一次模型调用（[spa-agent.ts:185](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。

### 4.3 `booking-agent.ts` + `spa-session.ts` —— 两步确认预约

- **职责**：把 SPA 预约拆成"提议（校验+问确认）"和"确认（真正下单）"两步，中间用每房间的内存会话态承接。
- **关键实现**：`proposeSpaBooking` 缺 serviceId/date/time 时逐项追问；有则调 `check_spa_availability` 校验，命中不可用时段就回列可用时段；可用才回"要我确认吗"。`confirmSpaBooking` 二次校验后调 `create_spa_booking`。`spaSession` 用两个 `Map`（`lastRecommended`、`pending`）记住上下文。

### 4.4 `mcp-client.ts` —— MCP 调用封装

- **职责**：把 `{server, tool, params}` 包成 JSON-RPC 2.0 `tools/call` 发给对应 MCP，并**解开 MCP 的 `{content:[{type:'text', text:'<json>'}]}` 信封**，让调用方直接拿到 payload（[mcp-client.ts:63](apps/tablet/src/lib/ai/tools/mcp-client.ts)）。
- **韧性**：`fetch` 失败/非 200/JSON-RPC error 分别返回 `{success:false, error}`，不抛异常——让上层 Agent 能优雅降级。

### 4.5 MCP 服务端（以 spa 为例）

- `index.ts`：Express 收 `POST /api/mcp`，**每个请求 new 一个 `McpServer` + `StreamableHTTPServerTransport`**，注册工具后处理请求（无状态）。
- `tools.ts`：用 `server.tool(name, desc, zodSchema.shape, handler)` 注册；所有返回都过 `textResult()` 包成 MCP 文本信封；入参用 Zod 校验。
- `data/spa-repo.ts`：`SpaRepo` 接口 + `mockRepo`/`dbRepo` 两实现，靠 `SPA_DATA_SOURCE` 环境变量切换。

---

## 5. 数据模型与数据流

### 核心数据结构

- **SpaService**（[spa/src/data/fixtures.ts](apps/mcp-servers/packages/spa/src/data/fixtures.ts)）：`id / nameEn / nameZh / nameId / category / durationMin / priceIdr / descEn / descZh / contraindications[] / maxPartySize`。其中 `contraindications`（禁忌项，如 pregnancy/high blood pressure）是给 Agent 做安全约束推理用的关键字段。
- **购物车项**（Redis，[shared/src/redis.ts](apps/mcp-servers/packages/shared/src/redis.ts)）：`{ item_id, quantity, special_instructions }`，键 `cart:{roomId}`，TTL 3600s。
- **PendingSpaBooking**（内存，[spa-session.ts](apps/tablet/src/lib/ai/spa-session.ts)）：`{ serviceId?, date?, time?, awaitingConfirmation? }`。
- **JSON-RPC 请求/响应**（[shared-types/src/index.ts](packages/shared-types/src/index.ts)）：标准 2.0 结构。
- **对话历史**（前端 store，[stores/conversation.ts](apps/tablet/src/lib/stores/conversation.ts)）：最多保留 10 轮（`slice(-9)`），避免 token 膨胀。

### 关键数据流

**点餐入购物车**：语音 `reply` 里的 dish → `order-agent.handleOrderIntent` → 先调 dining MCP `search_menu_items`（真实走 MySQL `SELECT ... FROM menu_items`）→ 命中则 `add_to_cart` 写 Redis；MCP 不可达时**回退到本地 `STATIC_MENU`**（[order-agent.ts:22](apps/tablet/src/lib/ai/agents/order-agent.ts)）。

**SPA 时段可用性**：`serviceId+date` → spa MCP `check_spa_availability` → `mockRepo.getAvailability` 用 `stableHash` 生成**确定性伪随机**（同 service+date+time 结果恒定，约 1/4 时段预占）+ 本进程内 `takenSlots` 叠加（[spa-repo.ts:75](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)）。

### 数据模型的三处"分裂"（重要，面试可讲）

同一个 SPA 概念在代码里有**三套互不一致的表示**：

| 来源 | id 样式 | 时段 | 用途 |
| --- | --- | --- | --- |
| MCP fixtures | `balinese-massage` | `09:00,10:00...` | 语音/AI 链路 |
| `/spa` 触屏页 server load | `sp-bali` | `10:00,11:30...` | 触屏 UI |
| `order-agent` STATIC_MENU | （dining，另一套）| — | MCP 兜底 |

而 `packages/shared-types` 里的 `LocalizedString` / `Language` **只有 `en|zh`**，却全项目都在用 `en|zh|id` 三语——共享类型与实际实现已脱节（详见第 9 节）。

---

## 6. 核心技术机制

### 6.1 强制工具调用 = 稳定的结构化输出

不再"让模型吐 JSON 再手工 parse"，而是定义 `respond` 工具并 `tool_choice` 强制调用，模型必须按 `input_schema`（`intent` 用 enum 限定、`entities`、`reply`）产出。`extractRespond()` 从返回的 `tool_use` block 里取结构化输入（[orchestrator.ts:284](apps/tablet/src/lib/ai/orchestrator.ts)）。**这解决了"自由文本 JSON 易破损"的老问题**。

### 6.2 流式结构化输出：从 tool-input JSON 增量抠出 `reply`

这是全项目最巧的一处。强制工具调用后，模型是把工具入参当 JSON **增量流式**吐出的（`input_json_delta`）。作者累积这段 JSON，用 `extractReplyProgress()` **一边流一边只把 `"reply":"..."` 字段里的新增字符**（含转义处理）抠出来推给 UI，实现"边生成边逐字显示回复"，最后再用 `safeParseRespond()` 容错解析完整对象拿到 intent/entities（[orchestrator.ts:316 & 370](apps/tablet/src/lib/ai/orchestrator.ts)）。**既拿到了结构化意图，又拿到了流式回复体验**——两者通常是矛盾的。

### 6.3 两层"文化优化"（Layer1 register + Layer2 检索）

- **Layer 1 register**（[cultural-register.ts](apps/tablet/src/lib/ai/cultural/cultural-register.ts)）：注入"礼貌称谓 Bapak/Ibu、间接委婉拒绝、清真/斋月敏感、Nyepi 不排预约"等 tone 指令，控制**怎么说**。
- **Layer 2 检索**（[cultural-kb.ts](apps/tablet/src/lib/ai/cultural/cultural-kb.ts)）：一个手写的 Saka/巴厘文化 KB + 关键词打分检索（`retrieveCulturalFacts`，长 tag 权重更高 + 正文词轻量重叠），把相关事实拼进 prompt，控制**说得对不对**。作者在注释里明确说这层日后可平滑替换成向量/RAG 而不改调用方——**面向替换的接口设计**。

### 6.4 Agentic 工具循环 + 安全约束

`runSpaConcierge` 的多跳循环里，工具执行前用 `SPA_READ_TOOLS` 白名单卡住"只读"，禁止在推荐阶段触发下单（[spa-agent.ts:137](apps/tablet/src/lib/ai/agents/spa-agent.ts)）；prompt 里要求依据 `contraindications` 规避不适宜疗程。**"推荐只读、下单单独确认"的权限隔离**是刻意的安全设计。

### 6.5 双层时段校验（防超卖的幼稚版）

预约链路里，`booking-agent` 提议时校验一次可用性，`spa-repo.createBooking` 落单时**再校验一次**并把时段加入 `takenSlots`。两层校验 + 单进程内存态，能在 demo 里防止同会话重复占用；但**不是真正的并发安全**（详见第 8 节难点）。

### 6.6 STT 幻觉过滤

Whisper 对静音/噪声常幻觉出"thanks for watching / 请订阅"等字幕腔字符串，`/api/stt` 用正则黑名单 + 去 emoji + 纯标点判断把这些丢弃，并对模型误判的日/韩语种直接返回空（[api/stt/+server.ts:7](apps/tablet/src/routes/api/stt/+server.ts)）。**这是真实语音产品里必踩的坑，代码里有针对性处理。**

---

## 7. 工程亮点与面试价值

### 亮点 1：流式结构化输出（边流 reply、边拿结构化 intent）

- **对应需求**：语音助理要"话音未落就开始回话"（低延迟体感），同时后端又必须拿到结构化 intent 才能分发业务。二者天然冲突。
- **代码中如何实现**：`streamConversation` 监听 `input_json_delta` 累积工具入参 JSON，`extractReplyProgress` 用手写状态机（处理 `\"`、`\n` 等转义）实时从半截 JSON 里抠 `reply` 字段增量推 SSE；流结束再 `safeParseRespond` 容错解析完整对象（[orchestrator.ts:370-413](apps/tablet/src/lib/ai/orchestrator.ts)）。
- **为什么有技术价值**：直接对整段回复做 TTS/等待会有明显停顿；纯自由文本流式又拿不到可靠 intent。这个做法**在"强制工具调用"的约束下同时拿到流式体验和结构化数据**，是对 SDK 能力的深度利用，而不是简单调用。
- **面试官可能追问**：① 为什么不直接让模型先流 reply 文本、再单独出一段 JSON？② 转义/多字节字符在半截 JSON 里怎么保证不乱码？③ 如果 `reply` 字段不是 JSON 的第一个键、或模型改了键顺序会怎样？
- **推荐回答思路**：强调"单次调用、单一事实来源"避免两段输出不一致；指出 `extractReplyProgress` 只按 `"reply"` key 定位、按字符扫描并处理转义，多字节字符因按 JS 字符串处理不受影响；坦诚承认它依赖 `reply` 键存在、对键顺序不敏感（是按 key 匹配而非位置），但对"字段被拆到多个 delta"是安全的。

### 亮点 2：MCP 作为"人机同源"的后端协议

- **对应需求**：同一批业务能力（查 SPA、查菜单、下单）既要给触屏 UI 用，也要给 AI Agent 当工具用。
- **代码中如何实现**：业务全部实现为 MCP `server.tool(...)`（[spa/src/tools.ts](apps/mcp-servers/packages/spa/src/tools.ts)）；BFF 路由直接 `callMcpTool` 调（[api/spa/+server.ts](apps/tablet/src/routes/api/spa/+server.ts)），AI Agent 也 `callMcpTool` 调（[spa-agent.ts:138](apps/tablet/src/lib/ai/agents/spa-agent.ts)），二者共用 `mcp-client.ts`。
- **为什么有技术价值**：避免"给人一套 REST、给 AI 再包一套 function"的重复维护；工具描述（description/schema）天然就是给 LLM 的说明书，Zod schema 同时做运行时校验和工具入参声明。
- **面试官可能追问**：① MCP 相比直接写 REST + 手动定义 function tools 到底多了什么？② 每请求 new 一个 McpServer 的开销与取舍？
- **推荐回答思路**：讲"协议统一 + 自描述工具"减少漂移；对开销诚实——当前是无状态换简单，量大时应复用 server 实例或换常驻连接。

### 亮点 3：分层文化本地化（register + 可检索 KB）

- **对应需求**：巴厘岛度假村面对中/英/印尼多文化客群，回复不能是生硬直译，要符合当地礼节且事实正确（如 Nyepi 不能排预约）。
- **代码中如何实现**：`culturalRegister` 控 tone，`cultural-kb` 做关键词检索把事实注入 prompt，二者在 `runSpaConcierge` 的 system 里拼接（[spa-agent.ts:106-114](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。
- **为什么有技术价值**：把"风格"和"事实"分层——风格用固定指令省 token，事实用检索按需注入，且 KB 接口预留了换向量库的空间，属于**可演进的 RAG 雏形**而非硬编码 prompt。
- **面试官可能追问**：① 关键词打分检索的召回/精度局限？② 什么时候该升级成向量检索？
- **推荐回答思路**：承认关键词法对同义/跨语言召回弱（现在靠 tag 里塞中英文关键词硬凑），当 KB 规模变大或查询表达多样时换 embedding；强调调用方接口不变（`retrieveCulturalFacts`）是为此铺路。

### 亮点 4：确定性 serviceId 解析器（省一次 LLM 调用）

- **对应需求**：预约链路里已知客人提到某疗程名，只需映射到目录 id，没必要再花一次模型调用和延迟。
- **代码中如何实现**：`resolveSpaServiceId` 拉目录后做多信号打分——id/全名强匹配(+8~10)、英文长词分词重叠(+2)、**中文 2-gram 重叠**(+2) 处理"巴厘按摩"vs"传统巴厘按摩"这类部分名（[spa-agent.ts:185](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。
- **为什么有技术价值**：把"能确定性解决的"从 LLM 手里拿回来，降延迟、降成本、提确定性——**该用规则的地方不硬上模型**的工程判断力。
- **面试官可能追问**：① 打分阈值/权重怎么定？误匹配如何兜底？② 为什么用 2-gram 而不是分词？
- **推荐回答思路**：讲"强信号优先、弱信号叠加、取最高分且 >0"；中文无空格分词成本高，2-gram 对短名鲁棒；兜底是返回 null 后由上游继续用 `lastRecommended`/pending 补齐。

> 项目规模决定亮点到此为止——其余域（restaurant/transport/info）尚是骨架，不硬凑亮点。

---

## 8. 技术难点与解决方案

### 难点 1：既要流式回复、又要结构化意图

- **难点是什么**：一次 LLM 调用里同时满足"低延迟逐字回复"与"可靠结构化 intent"。
- **为什么会出现**：强制工具调用保证了结构化，但它把内容作为工具入参 JSON 流出，天然不是"人读的文本流"。
- **当前代码如何解决**：见亮点 1——增量解析工具 JSON 的 `reply` 字段。
- **方案不足**：强依赖 `reply` 键与 JSON 结构；语音本身仍是**整段 TTS**（`speakText` 等全片合成才播放），所以"文字流式了、声音没流式"，README 也如实标注了这一点。
- **下一步优化**：接入支持句子级/流式合成的 TTS，按标点切句边生成边播；或迁移到 Realtime 语音 API。
- **面试时如何讲**：我识别到"结构化 vs 流式"的冲突→选择在工具调用协议下做增量字段解析拿到文字流式→但清楚声音链路仍是瓶颈，规划了句级 TTS 作为下一步。

### 难点 2：SPA 预约的时段一致性与"确认门"

- **难点是什么**：多轮对话里客人分批给出疗程/日期/时间，且必须避免"话说着就把单下了"以及超卖。
- **为什么会出现**：语音是多轮增量输入；预约是有副作用的写操作，需要显式确认与并发防护。
- **当前代码如何解决**：`spaSession` 逐轮 `mergePending` 累积字段；`awaitingConfirmation` 作为确认门；`booking-agent` 与 `spa-repo` 双层校验时段（[booking-agent.ts:75](apps/tablet/src/lib/ai/agents/booking-agent.ts) + [spa-repo.ts:90](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)）。
- **方案不足**：`spaSession` 与 `takenSlots` 都是**单进程内存态**——多实例部署下状态不共享，且 `takenSlots` 无 TTL/持久化，进程重启即丢；两层校验之间**没有锁**，真并发下仍可能超卖。
- **下一步优化**：会话态迁到 Redis（项目已有 `@allstay/shared/redis`，`spa-session.ts` 注释里也这么写）按房间键存；下单用数据库事务/唯一约束或 Redis 原子操作保证时段唯一。
- **面试时如何讲**：我先用内存态快速跑通"多轮 + 确认"的产品体验，同时在注释里标明单实例限制和 Redis 迁移路径——这是有意识的技术债，而非疏忽。

### 难点 3：语音识别在真实环境下的噪声与语种误判

- **难点是什么**：静音/背景噪声会让 Whisper 幻觉出无意义文本、误判语种。
- **为什么会出现**：ASR 模型对低信噪比输入倾向"编"出训练语料里的高频串（字幕腔）。
- **当前代码如何解决**：`/api/stt` 幻觉正则黑名单 + 去 emoji + 纯标点判定 + 非目标语种直接返回空；前端 VAD 还会把 <500 字节的小 blob 直接丢弃重新监听（[VoiceAssistant.svelte:149](apps/tablet/src/lib/components/VoiceAssistant.svelte)）。
- **方案不足**：黑名单是启发式，覆盖不全；阈值（RMS、静默时长）是经验值，不同环境需调。
- **下一步优化**：引入置信度/logprob 过滤、或服务端 VAD；阈值做成可配置或自适应。
- **面试时如何讲**：突出"我知道 Whisper 会幻觉字幕腔"这类实战经验，讲清多道防线（前端 VAD + 后端黑名单 + 语种兜底）。

---

## 9. 当前不足与技术债

### 债 1：认证/会话完全是占位实现

- **问题是什么**：登录、会话校验都没真正实现。
- **代码中哪里体现**：[hooks.server.ts](apps/tablet/src/hooks.server.ts) 里 `event.locals.staffId = 'staff_from_token'` 且注释 `// TODO: verify token`；[stores/auth.ts](apps/tablet/src/lib/stores/auth.ts) 的 `login/logout/loadFromStorage` 全是 TODO；`.env` 里 `SESSION_SECRET`/`STAFF_PIN_SALT` 在代码中未被使用。
- **会带来什么影响**：任何持有 cookie 的请求都被视为已登录，无真实鉴权——生产环境安全风险高。
- **如何改进**：接真实会话存储（Redis/DB）+ 校验 token；PIN 用 `STAFF_PIN_SALT` 加盐哈希。
- **优先级建议**：**高**（安全面广、且是上线前置条件；修复成本中等）。

### 债 2：SPA 数据三套分裂 + 共享类型脱节

- **问题是什么**：SPA 目录/时段有三套不一致来源；`shared-types` 只支持 `en|zh`，实际用 `en|zh|id`。
- **代码中哪里体现**：MCP `fixtures.ts`（`balinese-massage`）vs `/spa/+page.server.ts`（`sp-bali`）vs `order-agent` 的 `STATIC_MENU`；[shared-types/src/index.ts](packages/shared-types/src/index.ts) 的 `Language='en'|'zh'`。
- **会带来什么影响**：语音订的疗程和触屏看到的对不上；改一处目录要改多处；`nameId`/`id` 语种在共享类型里"无名分"，靠各处自定义类型硬撑。
- **如何改进**：目录数据收敛到 SPA MCP 单一来源，触屏页也走 MCP；`shared-types` 升级为三语并统一 `LocalizedString`。
- **优先级建议**：**中高**（影响一致性与可维护性，修复成本中等）。

### 债 3：会话态在内存、无并发/持久化保障

- **问题是什么**：`spaSession`、`mockRepo.takenSlots` 均为单进程内存态。
- **代码中哪里体现**：[spa-session.ts:21](apps/tablet/src/lib/ai/spa-session.ts) 两个 `Map`；[spa-repo.ts:41](apps/mcp-servers/packages/spa/src/data/spa-repo.ts) 的 `takenSlots`。
- **会带来什么影响**：多实例/重启丢状态；`pending` 无过期→长期运行内存泄漏；无锁→并发超卖。
- **如何改进**：迁 Redis 并加 TTL；下单加原子性保证。
- **优先级建议**：**中**（demo 无碍，规模化前必修）。

### 债 4：后端多为占位/未接真实 PMS

- **问题是什么**：真实数据库路径大量 TODO。
- **代码中哪里体现**：`dbRepo` 所有方法 `throw 'not implemented'`（[spa-repo.ts:137](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)）；dining `place_order` 有 `// TODO: INSERT into cakrasoft_pms`，且把 `staff_id` 当 `roomId`、`price:0`、名称未从库解析（[dining/src/tools.ts:80](apps/mcp-servers/packages/dining/src/tools.ts)）；`info-agent` 是静态 FAQ（[info-agent.ts:13](apps/tablet/src/lib/ai/agents/info-agent.ts)）；`apps/ai-orchestrator` 仅有 README。
- **会带来什么影响**：dining `search_menu_items` 直接查 `menu_items` 表，库不存在时依赖 `order-agent` 的静态兜底才不崩；下单打印的价格/名称是错的。
- **如何改进**：实现 `dbRepo`、补 orders 落库、`place_order` 用真实 room_id 与从库解析的名称/价格。
- **优先级建议**：**中**（属"未完成"而非"错误设计"，按业务节奏推进）。

### 债 5：印尼语半接线

- **问题是什么**：`id` 语种链路不完整。
- **代码中哪里体现**：STT `LANG_MAP` 支持 `indonesian/malay→id`（[api/stt/+server.ts:55](apps/tablet/src/routes/api/stt/+server.ts)），Agent 回复也有 `id` 分支；但 `shared-types` 不含 `id`，且 README 明确说 Indonesian "not wired yet"。
- **会带来什么影响**：三语支持在不同层深浅不一，易出"某层支持某层不支持"的缝。
- **如何改进**：统一三语的类型与测试覆盖。
- **优先级建议**：**低-中**（取决于是否真有印尼语客群需求）。

### 债 6：几乎无自动化测试

- **问题是什么**：除 `evals/cultural/testset.json` 外未见单测/集成测试。
- **代码中哪里体现**：仓库无 `*.test.ts`；`package.json` 无 test 脚本。
- **会带来什么影响**：`extractReplyProgress`、`resolveSpaServiceId` 这类纯函数逻辑复杂却无回归保护，重构风险高。
- **如何改进**：先给纯函数（解析器、匹配器）补单测，再补 orchestrator dispatch 的表驱动测试。
- **优先级建议**：**中**（针对高复杂纯函数收益最大）。

---

## 10. 可继续开发的高价值方向

> 以下均为**建议**，非已实现。区分度：带"建议/可"字样。

1. **语音真流式（最高价值）**：当前文字已流式、声音仍整段。建议接句级/流式 TTS 或 Realtime 语音 API，让"边说边播"，显著降低对话延迟。
2. **收敛数据单一来源**：把 SPA/菜单目录统一到 MCP，触屏与语音共用，消除第 9 节债 2 的三套分裂。
3. **补齐鉴权与会话**：实现真实 token 校验、PIN 加盐、会话态入 Redis——上线前置。
4. **接真实 Cakrasoft PMS**：实现 `dbRepo`、订单落库、打印用真实价格/名称。
5. **把 orchestrator 抽成独立服务**（architecture.md 的 Phase 4）：当前内嵌 SvelteKit，抽出后可独立扩缩容、被多端复用。
6. **文化 KB 升级为向量检索**：接口已预留，规模变大时替换 `retrieveCulturalFacts` 内部实现。
7. **补关键纯函数的测试**：解析器/匹配器/dispatch。

---

## 11. 面试讲述稿（可直接口述，约 450 字）

> AllStay 是我参与的一套巴厘岛酒店客房平板服务系统。它有两条动线：触屏点单和一个常驻的多语言语音管家。我主要在语音和 AI 编排这条线上。
>
> 整体是一个 monorepo：前端是 SvelteKit，同时充当 BFF；后端我们没有写传统 REST，而是把每个业务域做成 MCP 服务——dining、spa、restaurant、transport 各一个进程，业务能力以"AI 可调用的工具"形式暴露。这样同一套工具，既给触屏页调，也给 AI Agent 当工具调，不用维护两套接口。
>
> 语音链路是：唤醒词 + 前端 VAD 断句 → Whisper 转写 → Claude 做意图识别 → 分发到域 Agent 调 MCP → OpenAI TTS 播报。这里我最想讲的技术点是**流式结构化输出**：我们用 Claude 的强制工具调用拿到 `{intent, entities, reply}` 的结构化结果，但这样内容是作为工具入参 JSON 流出的、不是给人读的文本流。我写了一个增量解析器，一边累积这段 JSON、一边只把 `reply` 字段的新增字符抠出来推给前端逐字显示——**同时拿到了结构化意图和流式回复体验**，这两者通常是冲突的。
>
> SPA 预约我做了"提议 → 确认"两步流程和多轮上下文记忆，下单前双层校验时段。另外为了省成本，我把"疗程名→id"用一个带中文 2-gram 匹配的确定性解析器解决，而不是再花一次模型调用。
>
> 难点主要在"结构化 vs 流式"的取舍、以及会话态目前还在内存、并发和多实例是已知技术债——我在注释里标了 Redis 迁移路径。声音目前还是整段合成，下一步想做句级流式 TTS。

---

## 12. 代码证据索引

| 结论 / 论断 | 代码位置 |
| --- | --- |
| 强制工具调用拿结构化输出 | `orchestrator.ts:252-275, 352-361`（RESPOND_TOOL, tool_choice） |
| 流式增量抠 reply 字段 | `orchestrator.ts:316-348`（extractReplyProgress）、`370-413`（streamConversation） |
| 意图分发 switch | `orchestrator.ts:102-242`（dispatchParsed） |
| SPA Agentic 工具循环 | `agents/spa-agent.ts:94-172`（runSpaConcierge, MAX_HOPS=4, 只读白名单） |
| 确定性 serviceId 解析（中文 2-gram） | `agents/spa-agent.ts:185-218`（resolveSpaServiceId） |
| 两步预约 propose/confirm | `agents/booking-agent.ts:52-175` |
| 每房间会话态（内存） | `ai/spa-session.ts`（lastRecommended, pending Map） |
| 两层文化优化 | `ai/cultural/cultural-register.ts`、`ai/cultural/cultural-kb.ts` |
| MCP 客户端 + 信封解包 | `ai/tools/mcp-client.ts:26-79` |
| MCP 服务端每请求实例化 | `mcp-servers/packages/spa/src/index.ts:9-15` |
| Zod 工具入参校验 | `mcp-servers/packages/spa/src/tools.ts`、`schemas/spa.schema.ts` |
| SpaRepo mock/db 切换 | `mcp-servers/packages/spa/src/data/spa-repo.ts:137-156` |
| 确定性伪随机时段 | `spa-repo.ts:48-82`（stableHash, getAvailability） |
| Redis 购物车 TTL 1h | `mcp-servers/packages/shared/src/redis.ts:20-23` |
| ESC/POS 打印 | `mcp-servers/packages/shared/src/printer.ts` |
| STT 幻觉过滤 | `routes/api/stt/+server.ts:7-32, 60-64` |
| 语音状态机 + VAD | `components/VoiceAssistant.svelte`、`utils/silence-vad.ts`、`utils/wake-detector.ts` |
| 认证占位 | `hooks.server.ts:11-13`、`stores/auth.ts` |
| dining 真实 SQL + place_order TODO | `mcp-servers/packages/dining/src/tools.ts:19-31, 80-104` |
| 点餐静态兜底 | `agents/order-agent.ts:22-111, 172-192` |
| 数据三套分裂 | `spa/fixtures.ts` vs `routes/spa/+page.server.ts` vs `order-agent.ts` |
| 共享类型只支持 en/zh | `packages/shared-types/src/index.ts:3-8` |

---

## 13. 给后续 AI 笔记系统的导入提示

**建议沉淀为知识卡片的知识点（每条一句话）：**

1. 用 Anthropic 强制工具调用（`tool_choice`）可把 LLM 输出约束成 schema 化对象，替代脆弱的自由文本 JSON 解析。
2. 强制工具调用时内容以 `input_json_delta` 流出，可增量解析特定字段实现"结构化 + 流式"兼得。
3. MCP 让业务能力以自描述工具形式暴露，可同时服务人类前端与 AI Agent，避免双份接口。
4. Agentic 工具循环 = "模型请求工具→执行→回填 tool_result→再问"，配只读白名单可做权限隔离。
5. Prompt 分层：register（怎么说，固定）+ 检索事实（说得对，按需注入）是低成本 RAG 雏形。
6. 能用确定性规则解决的匹配（如名称→id）不必调 LLM，可省延迟与成本；中文可用 2-gram 匹配。
7. 有副作用的写操作（预约）应设"确认门"+ 幂等/并发保护；内存态需明确其单实例局限。
8. 真实语音产品必须处理 ASR 幻觉（静音字幕腔）、前端 VAD 断句、小音频丢弃。
9. `SpaRepo` 式接口 + mock/db 双实现 + 环境变量切换，是"先跑通再接真库"的经典解耦。
10. "文档滞后于代码"是常态——判断项目实际能力要以代码为准（本项目 README limitations 多处已被实现超越）。

**建议标签/分类**：`#LLM应用` `#AnthropicClaude` `#工具调用` `#流式输出` `#MCP` `#RAG` `#SvelteKit` `#语音交互` `#Agent架构` `#技术债治理`

**可延伸的复习问题：**

- 如何在一次 LLM 调用里同时获得可靠的结构化意图和逐字流式回复？各自的失败模式是什么？
- MCP 相比"REST + 手写 function tools"在多端复用上的具体优势与代价（每请求实例化开销）？
- 语音预约这类多轮 + 副作用场景，如何设计会话态、确认门与并发防护？内存态迁 Redis 要注意什么？
- 分层文化本地化里，"register 固定 + 事实检索"为什么比"全塞进大 prompt"更省且更准？何时该升级为向量检索？
- 一个项目 README 的能力描述与代码不符时，你会用什么方法快速判断"真实能力边界"？
