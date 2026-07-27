# AllStay 技术分析文档

> 本文基于对仓库源码（分支 `feature/aki-realtime-stream`）的逐层阅读整理，而非复述 README。凡是"看得见的事实"都关联到具体文件/函数；凡是"推断"都标注了依据。文档中若指出与 README 不符之处，以**代码实现**为准。
>
> 本次为**重写版**：项目在语音、AI 编排、模型路由、文化本地化、安全约束、评测体系上做了大量迭代，老版分析已明显滞后（例如"声音没流式""SPA 数据三套分裂""几乎无自动化测试"等结论均已被代码超越）。本文按当前代码重新评估。

---

## 1. 项目定位与真实需求

AllStay 是一套**面向巴厘岛度假酒店的客房平板服务系统**。真实使用者是"住在客房里的客人"和背后的酒店运营方，核心痛点是：

- 客人在房间里想点餐、订 SPA、问酒店信息时，不想打前台电话、不想下 App，且常有语言障碍（中/英/印尼混住），还常带**文化与安全约束**（清真、斋月、孕期禁忌、Nyepi 静居日等）。
- 酒店希望把这些"客房增值服务"的动线搬到平板上，尽量自动化，同时**不替换**当地已有的排班/PMS 系统（Cakrasoft），而是"把最后一步喂到位"给本地员工。

围绕这个需求，项目做了三件在代码上都能坐实的事：

1. **触屏点单动线**：`apps/tablet` 是一个 SvelteKit 应用，提供 `/dining`、`/spa`、`/restaurants`、`/explore/*` 等页面（[apps/tablet/src/routes](apps/tablet/src/routes)）。
2. **常驻语音管家动线**：一个"随时能唤醒说话"的多语言语音礼宾（[VoiceAssistant.svelte](apps/tablet/src/lib/components/VoiceAssistant.svelte)），说一句话就能点餐/问询/订 SPA。这是**含金量最高、主力开发的部分**（分支名即 `realtime-stream`）。
3. **员工侧工单桥**：SPA 预约确认后，系统把结构化的 Bahasa 工单交给本地 SPA 前台（[/staff](apps/tablet/src/routes/staff/+page.server.ts)），人只做"录入 Cakrasoft"这一步低风险动作——**"wrap, don't replace"**。

后端按业务域拆成 **4 个 MCP（Model Context Protocol）服务**：dining / spa / restaurant / transport（[apps/mcp-servers/packages](apps/mcp-servers/packages)）。这个选型透露了设计意图——**让业务能力以"AI 可调用的工具"形式暴露**，而不仅是给前端调的 REST。

**复杂度评估（诚实版）**：这个项目的**业务 CRUD 本身不复杂**（查目录 → 选时段 → 下单）。真正有含金量、值得展开的是围绕语音礼宾的一整套 **AI 工程**：模型路由、流式结构化输出、句级流式语音、代码级安全约束、文化本地化的术语锁定与校验门、以及一套**打真实链路的评测体系**。餐厅/交通仍停留在骨架，本文如实说明其占位状态，不强行拔高。

**与老版/README 的关系**：README 的 "Known limitations" 多处已被代码超越（info 已接地、MCP 已真正打通、SPA 数据已单源、语音已句级流式），这些"文档滞后于实现"的迭代，恰是面试里能讲的故事。第 8/9 节会逐条点出。

---

## 2. 核心用户流程 / 业务流程

### 流程 A：语音点餐/问询（唤醒 → 意图 → 流式回复 → 句级流式语音）——主线

从客人开口到平板回话，完整链路（每步都能在代码里找到落点）：

1. **唤醒**：`WakeDetector` 用浏览器 `webkitSpeechRecognition` 持续监听，命中唤醒词即进入会话（[wake-detector.ts](apps/tablet/src/lib/utils/wake-detector.ts)）。
2. **录音 + 停顿检测**：进入 `listening` 态，`MediaRecorder` 录音，`attachSilenceVAD` 用 `AnalyserNode` 算 RMS，"说完 + 静默"即结束（[silence-vad.ts](apps/tablet/src/lib/utils/silence-vad.ts)、[VoiceAssistant.svelte:103](apps/tablet/src/lib/components/VoiceAssistant.svelte)）。
3. **STT**：音频 blob POST 到 `/api/stt`，走 OpenAI `whisper-1`（`verbose_json` 自动语种检测），带**幻觉过滤**（见 6.7），返回 `{ text, detected }`（[api/stt/+server.ts](apps/tablet/src/routes/api/stt/+server.ts)）。
4. **对话（SSE 流式）**：`processVoiceInput` 把文本 + 房间号 + 历史 POST 到 `/api/conversation`，服务端 `streamConversation()` 调 Claude，边生成边把 `reply` **逐字**经 SSE 推回（`{t:'chunk'}`）（[ai-conversation.ts](apps/tablet/src/lib/services/ai-conversation.ts) + [orchestrator.ts:432](apps/tablet/src/lib/ai/orchestrator.ts) + [api/conversation/+server.ts](apps/tablet/src/routes/api/conversation/+server.ts)）。
5. **句级流式语音**：前端每收到一段增量，用 `extractSentences` 抽出**已完成的整句**立即 `enqueueSpeech` 交给 TTS 队列，语音在**第一句就开始播**，同时开启 barge-in 监听（[VoiceAssistant.svelte:236](apps/tablet/src/lib/components/VoiceAssistant.svelte)、[sentence-chunker.ts](apps/tablet/src/lib/utils/sentence-chunker.ts)、[tts.ts](apps/tablet/src/lib/utils/tts.ts)）。
6. **意图分发 + 本地化**：流结束后 `dispatchParsed()` 按 `intent` 路由到域 Agent（调 MCP）；若客人说印尼语，`localize()` 再走**两阶段本地化**（Claude 草稿 → SEA-LION 母语润色 → 校验门）（[orchestrator.ts:122/419](apps/tablet/src/lib/ai/orchestrator.ts)）。

> 关键模块：`VoiceAssistant.svelte`（状态机 + 句级 TTS + barge-in）→ `ai-conversation.ts`（客户端编排）→ `api/stt|conversation|tts`（BFF）→ `orchestrator.ts` → `llm-gateway.ts` / `agents/*` / `curation/*` / `constraints/*` → `mcp-client.ts` → 各 MCP。

### 流程 B：语音订 SPA（多轮 + 代码级安全门 + 显式确认 + 员工工单）

这是全项目最完整、也最能体现工程判断的业务流程：

1. **推荐**：客人问"推荐个 SPA" → `spa_info` → `runSpaConcierge()` 跑**只读工具的 Agentic 循环**（`list_spa_services`/`get_spa_service`/`check_spa_availability`），产出有数据支撑的推荐，并记住"最后推荐的疗程"（[spa-agent.ts:93](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。
2. **健康/信仰画像累积**：任意一轮里客人提到孕期/高血压/过敏/斋戒，`spaSession.mergeGuest` 都会跨轮累积，供后续预约的安全校验用（[orchestrator.ts:128](apps/tablet/src/lib/ai/orchestrator.ts) + [spa-session.ts:47](apps/tablet/src/lib/ai/spa-session.ts)）。
3. **提议 + 代码级安全门**：客人说"就订这个，明天下午三点" → `booking_spa` → `proposeSpaBooking()` 先跑 `validateBooking()` **在代码里**硬校验禁忌/Nyepi/人数，命中 block 直接拒（不是靠 prompt 祈祷）；通过再校验时段可用性，**只提议、不落单**（[booking-agent.ts:68](apps/tablet/src/lib/ai/agents/booking-agent.ts) + [constraints/index.ts:100](apps/tablet/src/lib/ai/constraints/index.ts)）。
4. **确认**：客人说"确认" → `confirm_booking` → 校验有待确认项后调 `create_spa_booking`；**MCP 服务端再跑一遍 `guardBooking()`**（纵深防御），成功后清空 pending（[orchestrator.ts:222](apps/tablet/src/lib/ai/orchestrator.ts) + [spa/tools.ts:54](apps/mcp-servers/packages/spa/src/tools.ts) + [spa/constraints.ts:52](apps/mcp-servers/packages/spa/src/constraints.ts)）。
5. **员工工单**：确认成功后 `buildWorkOrder()` 生成结构化 Bahasa 工单（含疗程、时段、**健康安全旗标**、确认码），`notifyStaff()` fire-and-forget 分发到 console/打印机/`/staff` 页；前台点一下"录入 Cakrasoft"完成人在环（[booking-agent.ts:238](apps/tablet/src/lib/ai/agents/booking-agent.ts) + [staff/work-order.ts](apps/tablet/src/lib/ai/staff/work-order.ts) + [staff/notify.ts](apps/tablet/src/lib/ai/staff/notify.ts)）。

### 流程 C：触屏点餐/订 SPA（不经过 AI，但已单源）

`/dining`、`/spa` 等页面各有 `+page.server.ts` 提供数据、`+page.svelte` 做 UI，购物车走 `/api/cart` → dining MCP → Redis。**重要变化**：`/spa` 触屏页**已改为拉取与语音链路同一套 MCP `list_spa_services` 目录**（单一数据源），不再是老版里自己硬编码的 `sp-bali`（[spa/+page.server.ts:29](apps/tablet/src/routes/spa/+page.server.ts)）。老文档第 9 节的"数据三套分裂"债已基本消除。

---

## 3. 总体技术架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        apps/tablet  (SvelteKit)                       │
│                                                                       │
│  路由页面 (+page.svelte)              语音管家 VoiceAssistant          │
│      │                                    │  唤醒/VAD/句级流式TTS/barge│
│      │ 表单/交互                          │  extractSentences→TTS队列  │
│      ▼                                    ▼                           │
│  ┌──────────────── BFF: src/routes/api/* ─────────────────────────┐  │
│  │  /stt  /tts   /conversation(SSE)   /cart /menu /spa /booking …  │  │
│  └───────┬───────────────┬──────────────────────────┬─────────────┘  │
│          │               │                          │                │
│     OpenAI          AI 编排层 lib/ai/*            mcp-client          │
│  (whisper/tts)   ┌─────────────────────────────┐                     │
│                  │ orchestrator (意图分类/分发) │                     │
│                  │ llm-gateway  (模型路由+两阶段本地化+校验门)         │
│                  │ providers/*  (anthropic|sealion|mock)             │
│                  │ agents/*     (spa/booking/order/info)             │
│                  │ curation/*   (glossary锁 + cultural KB + few-shot)│
│                  │ constraints/*(禁忌/Nyepi/人数/斋月 — 代码级)      │
│                  │ staff/*      (工单 + 通知)                        │
│                  └───────┬──────────────┬──────────┘                 │
└──────────────────────────┼──────────────┼───────────────────────────┘
       Anthropic Claude ◀───┘   SEA-LION   │ JSON-RPC 2.0 / HTTP(SSE)
       (推理/工具调用)         (印尼语润色)  ▼
        ┌──────────┬──────────┬──────────────┬──────────────┐
        │ dining   │  spa     │ restaurant   │ transport    │
        │ MCP:3001 │ MCP:3002 │ MCP:3003     │ MCP:3004     │
        │          │+服务端    │              │              │
        │          │ guardBooking(纵深防御)   │              │
        └────┬─────┴────┬─────┴──────┬───────┴──────┬───────┘
         Redis(cart)  SpaRepo    (mock/占位)     (mock)
         ESC/POS打印  mock/db可切换
             │
        Cakrasoft PMS (MySQL, 多为 TODO/占位)

  评测: evals/runner/*  ── 打真实 /api/conversation ── LLM-as-judge ── before/after 表
```

**分层与职责**（部分为推断，依据：目录划分 + 依赖 + 命名）：

- **UI 层**（`routes/*/+page.svelte`、`lib/components`）：触屏页面与语音管家组件。
- **BFF 层**（`routes/api/*`）：SvelteKit server routes 充当 Backend-for-Frontend，**客户端从不直接访问 MCP/模型**，所有调用都由服务端代理。
- **AI 编排层**（`lib/ai`）：orchestrator（意图分类/分发）、llm-gateway（模型路由 + 两阶段本地化）、providers（模型适配）、agents（域逻辑）、curation（术语/文化/few-shot）、constraints（代码级安全）、staff（工单）、tools/mcp-client。
- **MCP 服务层**（`apps/mcp-servers/packages/*`）：每域一个独立 Express + MCP Server 进程，无状态，状态外置到 Redis / PMS；spa 还带**服务端二次安全校验**。
- **共享层**（`packages/shared-types`、`mcp-servers/packages/shared`）：跨包类型与基础设施（DB 连接池、Redis、打印机）。
- **评测层**（`evals/`）：打运行中的真实链路，LLM-as-judge 三维打分，输出 before/after。

**关键架构判断**：

- **MCP 作为"人机同源"的后端协议**：业务能力包装成 `tools/call`（JSON-RPC 2.0），同一套工具既被 BFF 直接调（[api/spa/+server.ts](apps/tablet/src/routes/api/spa/+server.ts)、[spa/+page.server.ts:30](apps/tablet/src/routes/spa/+page.server.ts)），也被 AI Agent 当工具调（[spa-agent.ts:134](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。**"给人用的接口"和"给 AI 用的工具"是同一套**。
- **模型分工**：强推理/工具调用**恒定用 Claude**；印尼语的"最后一步润色"路由到 **SEA-LION**（东南亚本地模型），且做**事实校验门 + 回退**，让弱模型永远不能编造事实（[llm-gateway.ts:38](apps/tablet/src/lib/ai/llm-gateway.ts)）。
- **安全由代码而非 prompt 保证**，且**双端校验**（tablet 提议前 + MCP 落单前）。
- **AI 暂时内嵌在 SvelteKit 里**（[docs/architecture.md](docs/architecture.md) 说 Phase 4 才抽出独立 orchestrator 服务；`apps/ai-orchestrator` 目前只有 README）。

---

## 4. 关键模块分析

只挑真正承载核心价值的模块，不做逐文件流水账。

### 4.1 `orchestrator.ts` —— AI 意图编排中枢

- **职责**：把一句自然语言变成"结构化意图 + 实体 + 回复"，分发到域 Agent，并在末尾做印尼语本地化。
- **关键实现**：用 Anthropic 的**强制工具调用**（`tool_choice:{type:'tool', name:'respond'}`）拿 schema 化输出（`RESPOND_TOOL`，[orchestrator.ts:302](apps/tablet/src/lib/ai/orchestrator.ts)）；`dispatchParsed()` 是意图大 `switch`，覆盖 order/checkout/cancel_order/spa_info/booking_spa/confirm_booking/info/other 等；`streamConversation` 做流式增量解析；`localize()` 是印尼语两阶段本地化的挂载点。
- **对外暴露**：`processConversation()`（一次性）与 `streamConversation()`（流式）。
- **依赖**：`providers/anthropic-provider`、`llm-gateway`、各 agents、`spa-session`、`constraints`。

### 4.2 `llm-gateway.ts` + `providers/*` —— 模型路由与两阶段本地化

- **职责**：把"如何调模型"与"调哪个模型"解耦；对印尼语跑"Claude 推理 → SEA-LION 润色 → 校验门 → 回退"。
- **关键实现**：`route()` 决策——分类/工具推理恒走 Claude，`phrase/localize` 且 `lang==='id'` 且 `PHRASE_MODEL` 开启时走 SEA-LION（未配 key 自动降级 Claude 草稿）（[llm-gateway.ts:38](apps/tablet/src/lib/ai/llm-gateway.ts)）；`phraseReply()` 让 SEA-LION 仅"重述"Claude 的草稿；`passesGate()` 校验润色结果**保留了草稿里出现过的锁定术语和每一个数字**，不达标就回退 Claude 草稿（[llm-gateway.ts:110](apps/tablet/src/lib/ai/llm-gateway.ts)）。
- **Provider 抽象**：`LlmProvider` 接口声明 `capabilities`（`tool_use`/`streaming`/`native_id`）；`sealionProvider` **只声明 `native_id`、刻意不给 `tool_use`**——它只负责换语气，不做任何决策（[providers/sealion-provider.ts:57](apps/tablet/src/lib/ai/providers/sealion-provider.ts)）。SEA-LION 走 OpenAI 兼容 API（换 baseURL 即可指向 Sahabat-AI 自托管）。
- **`mockProvider`**：无 GPU/无网络的离线替身，把草稿包一层 Bahasa 外壳、保留数字，使整条"路由→润色→校验→回退"链路可离线演示；`PHRASE_MOCK_DRIFT=1` 会故意丢数字/错译 Nyepi 来**证明校验门与回退真的生效**（[providers/mock-provider.ts](apps/tablet/src/lib/ai/providers/mock-provider.ts)）。

### 4.3 `spa-agent.ts` —— 带 RAG 与文化约束的 Agentic 循环

- **职责**：教模型"如何用 SPA 只读工具查真实数据并给出有据可依的推荐"。
- **关键实现**：`runSpaConcierge()` 是 `MAX_HOPS=4` 的工具循环——`stop_reason==='tool_use'` 时执行工具、回填 `tool_result`、继续下一跳，直到给出文本答案；工具执行前用 `SPA_READ_TOOLS` 白名单卡"只读"，禁止推荐阶段下单（[spa-agent.ts:112/133](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。system prompt 由技能说明 + 语言 + `buildCurationContext()` 拼成。
- **另一半**：`resolveSpaServiceId()` 是**不调 LLM 的确定性解析器**，把"巴厘按摩/Balinese massage"多信号打分匹配到目录 id（id/全名强信号、英文长词分词、中文 2-gram），供预约链路省一次模型调用（[spa-agent.ts:181](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。

### 4.4 `constraints/*` —— 代码级安全约束层

- **职责**：把危险规则**结构化到代码**，不靠 prompt。
- **关键实现**：`validateBooking()` 依次校验禁忌（hard block）、Nyepi（hard block）、节庆（soft warn）、人数（hard block）、斋月时段（soft warn），返回带 `severity` 与三语 message 的 violations；`CONDITION_ALIASES` 把中/印/英的健康表述归一到 fixtures 的规范 token（[constraints/index.ts:100](apps/tablet/src/lib/ai/constraints/index.ts)）。`calendar.ts` 是 Saka 历的**可审计数据源**（Nyepi 日期逐年更新，不硬编码进模型）（[constraints/calendar.ts:18](apps/tablet/src/lib/ai/constraints/calendar.ts)）。
- **纵深防御**：MCP 服务端另带一份**最小、无跨 app 依赖**的 `guardBooking()`，落单前再校验一次，客户端绕不过（[spa/constraints.ts:52](apps/mcp-servers/packages/spa/src/constraints.ts)）。

### 4.5 `curation/*` —— 术语锁定 + 文化检索 + few-shot

- **职责**：一次调用组装完整本地化上下文，并产出**可被下游校验的术语锁**。
- **关键实现**：`buildCurationContext()` 按 `CULTURAL_LAYERS`（off/register/kb/all）分层组装：L1 register（语气/敬语/敏感）、L2 cultural KB（检索到的 Nyepi/halal/canang sari 事实）、glossary（规范术语）、few-shot（印尼语活样例）（[curation/index.ts:62](apps/tablet/src/lib/ai/curation/index.ts)）。`buildGlossaryLocks()` 输出 machine-checkable 锁，正是 4.2 校验门验证的依据——**"术语一致性"从祈祷变成可验证**（[curation/glossary.ts:169](apps/tablet/src/lib/ai/curation/glossary.ts)）。

### 4.6 `booking-agent.ts` + `spa-session.ts` + `staff/*` —— 两步确认 + 员工工单

- **职责**：预约拆"提议（校验+问确认）"和"确认（真正下单+发工单）"两步，中间用每房间内存会话态承接。
- **关键实现**：`proposeSpaBooking` 校验通过才回"要我确认吗"；`confirmSpaBooking` 二次校验后调 `create_spa_booking`，成功即 `buildWorkOrder()` + `void notifyStaff()`（fire-and-forget，不阻塞客人回复）。`spaSession` 用三个 `Map`（`lastRecommended`/`pending`/`guests`）记忆上下文与健康画像（[spa-session.ts:29](apps/tablet/src/lib/ai/spa-session.ts)）。

### 4.7 `mcp-client.ts` —— MCP 调用封装（已修静默失败）

- **职责**：把 `{server, tool, params}` 包成 JSON-RPC 2.0 `tools/call` 发给对应 MCP，解开 `{content:[{type:'text', text:'<json>'}]}` 信封。
- **关键修复**：补 `Accept: application/json, text/event-stream`（否则 `StreamableHTTPServerTransport` 回 406），并**兼容解析 SSE `data:` 帧**（该 transport 可能以 SSE 返回）。修复前语音/BFF 的 MCP 调用一直**静默走兜底**、从未真正命中 MCP（[mcp-client.ts:40/81](apps/tablet/src/lib/ai/tools/mcp-client.ts)，详见第 8 节难点 4）。

---

## 5. 数据模型与数据流

### 核心数据结构

- **SpaService**（[spa/fixtures.ts](apps/mcp-servers/packages/spa/src/data/fixtures.ts)）：`id / nameEn / nameZh / nameId / category / durationMin / priceIdr / descEn / descZh / contraindications[] / maxPartySize`。`contraindications`（如 pregnancy/high blood pressure）是 constraints 层做安全推理的关键字段。**注意**：fixtures 有 `nameId` 但**没有 `descId`**（印尼语描述缺失，触屏页 fallback 到英文描述，见第 9 节）。
- **GuestProfile**（[constraints/index.ts:18](apps/tablet/src/lib/ai/constraints/index.ts)）：`pregnant / conditions[] / allergies[] / faith / fasting`，跨轮累积。
- **PendingSpaBooking**（内存，[spa-session.ts:15](apps/tablet/src/lib/ai/spa-session.ts)）：`serviceId? / date? / time? / awaitingConfirmation? / guest? / partySize? / notes? / therapistGenderPref?`。
- **GlossaryTerm / GlossaryLock**（[curation/glossary.ts:25](apps/tablet/src/lib/ai/curation/glossary.ts)）：规范三语术语 + `mustContain` 锁。
- **WorkOrder**（[staff/work-order.ts:27](apps/tablet/src/lib/ai/staff/work-order.ts)）：结构化 Bahasa 工单 + `guestFlags` 安全旗标 + `status`。
- **购物车项**（Redis，[shared/redis.ts](apps/mcp-servers/packages/shared/src/redis.ts)）：`{ item_id, quantity, special_instructions }`，键 `cart:{roomId}`，TTL 3600s。
- **对话历史**（前端 store）：仅保留最近数轮，避免 token 膨胀。

### 关键数据流

**点餐入购物车**：`order` 意图 → `order-agent.handleOrderIntent` → 先调 dining MCP `search_menu_items`（真实走 MySQL `SELECT ... FROM menu_items`）→ 命中则 `add_to_cart` 写 Redis；MCP 不可达时**回退本地 `STATIC_MENU`**（含中英别名 + 打分匹配）（[order-agent.ts:137](apps/tablet/src/lib/ai/agents/order-agent.ts)）。

**SPA 时段可用性**：`serviceId+date` → spa MCP `check_spa_availability` → `mockRepo.getAvailability` 用 `stableHash` 生成**确定性伪随机**（同 service+date+time 恒定，约 1/4 预占）+ 进程内 `takenSlots` 叠加（[spa-repo.ts:75](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)）。

**印尼语两阶段本地化数据流**：Claude 出 `reply`（草稿，含全部事实/数字）→ `phraseReply` 用 curation 组 system → SEA-LION 重述 → `passesGate` 校验术语锁 + 数字 → 通过用润色版、否则回退草稿（[llm-gateway.ts:74](apps/tablet/src/lib/ai/llm-gateway.ts)）。

### 数据模型现状（相较老版的收敛）

老版指出的"SPA 概念三套互不一致"已大幅收敛：触屏 `/spa` 页现在与语音链路**共用 MCP 目录单源**（[spa/+page.server.ts](apps/tablet/src/routes/spa/+page.server.ts)）。**仅剩两处遗留**：① `packages/shared-types` 里的 `LocalizedString`/`Language` **仍只有 `en|zh`**，而全项目实际用 `en|zh|id` 三语，靠各处自定义类型硬撑（[shared-types/src/index.ts:3](packages/shared-types/src/index.ts)）；② fixtures 缺 `descId`。详见第 9 节。

---

## 6. 核心技术机制

### 6.1 强制工具调用 = 稳定的结构化输出

不再"让模型吐 JSON 再手工 parse"，而是定义 `respond` 工具并 `tool_choice` 强制调用，模型必须按 `input_schema`（`intent` 用 enum 限定、`entities`、`reply`）产出。`extractRespond()`/`safeParseRespond()` 取结构化输入（[orchestrator.ts:302/334/349](apps/tablet/src/lib/ai/orchestrator.ts)）。**解决了"自由文本 JSON 易破损"的老问题**；judge 也用同一套纪律（forced tool_choice）保证评分 schema 化（[judge.ts:26](evals/runner/judge.ts)）。

### 6.2 流式结构化输出：从 tool-input JSON 增量抠出 `reply`

强制工具调用后，模型把工具入参当 JSON **增量流式**吐（`input_json_delta`）。`extractReplyProgress()` 累积这段 JSON，用手写状态机**一边流一边只把 `"reply":"..."` 字段的新增字符**（含转义处理）抠出来推给 UI，实现"边生成边逐字显示"；流结束再 `safeParseRespond()` 拿完整对象取 intent/entities（[orchestrator.ts:366/432](apps/tablet/src/lib/ai/orchestrator.ts)）。**既拿到结构化意图，又拿到流式回复体验**——两者通常矛盾。

### 6.3 句级流式 TTS + barge-in（老版瓶颈已解决）

老版的头号瓶颈是"文字流式了、声音仍整段合成"。现在：`sentence-chunker.extractSentences` 用一个跨 en/zh/id 标点的正则 + `consumed` 游标，从累积回复里**只抽出新完成的整句**；`tts.ts` 维护一个句子队列（`enqueueSpeech`/`drainQueue`/`waitForSpeechDrain`），**逐句合成、按序播放**，语音在第一句就开始，而非等整段（[sentence-chunker.ts:28](apps/tablet/src/lib/utils/sentence-chunker.ts)、[tts.ts:52](apps/tablet/src/lib/utils/tts.ts)、[VoiceAssistant.svelte:236](apps/tablet/src/lib/components/VoiceAssistant.svelte)）。配套 **barge-in**：播报时开一路带回声消除的麦克风，检测到持续 RMS（`BARGE_RMS`/`BARGE_FRAMES`）就 `stopSpeaking()` 并转听——客人可"打断"（[VoiceAssistant.svelte:149](apps/tablet/src/lib/components/VoiceAssistant.svelte)）。

### 6.4 双模型协作：Claude 推理 + SEA-LION 母语润色 + 校验门回退

见 4.2。要点：**决策权只在 Claude**（含全部事实/数字），SEA-LION 仅换语气；`passesGate` 只强制"草稿用过的术语锁 + 所有数字"必须保留，否则回退——**用弱模型提升母语自然度，但从结构上杜绝它编造/漏数字**（[llm-gateway.ts:110](apps/tablet/src/lib/ai/llm-gateway.ts)）。

### 6.5 安全由代码保证 + 纵深防御

见 4.4。`validateBooking`（tablet 提议前）与 `guardBooking`（MCP 落单前）是**两份刻意分离、无跨 app 依赖**的规则副本：孕妇永远进不了热石、Nyepi 硬阻断、超员拒绝——即便恶意客户端直连 `create_spa_booking` 也拦得住（[constraints/index.ts](apps/tablet/src/lib/ai/constraints/index.ts) + [spa/constraints.ts](apps/mcp-servers/packages/spa/src/constraints.ts)）。

### 6.6 两步预约的确认门 + 时段双层校验

`awaitingConfirmation` 是确认门（不确认不下单）；`booking-agent` 提议时校验一次可用性，`spa-repo.createBooking` 落单时**再校验一次**并把时段加入 `takenSlots`。demo 内能防同会话重复占用；但**非真正并发安全**（详见第 8 节难点 5）。

### 6.7 STT 幻觉过滤

Whisper 对静音/噪声常幻觉出"thanks for watching / 请订阅"等字幕腔，`/api/stt` 用正则黑名单 + 去 emoji + 纯标点判断丢弃，并对误判的非目标语种（日/韩）直接返回空；前端 VAD 还把 <500 字节小 blob 丢弃重听（[api/stt/+server.ts:7](apps/tablet/src/routes/api/stt/+server.ts)、[VoiceAssistant.svelte:222](apps/tablet/src/lib/components/VoiceAssistant.svelte)）。

### 6.8 评测体系：打真实链路 + LLM-as-judge

`evals/runner` 逐条把用例 POST 给**运行中的** `/api/conversation`（读 SSE 到 `{t:'done'}`），因此真实经过 orchestrator → gateway → curation → constraints → MCP → phrase 全链路（[harness.ts:20](evals/runner/harness.ts)）。三维打分：`task_completion`（确定性：意图/该不该下单）、`content_accuracy`（子串 mustMention/mustNotContain）、`cultural`（LLM-as-judge 逐条 criteria）（[run-eval.ts:52](evals/runner/run-eval.ts)、[judge.ts:49](evals/runner/judge.ts)）。行为由服务端 env（`CULTURAL_LAYERS`/`PHRASE_MODEL`）切换，`report.ts` 自动汇总 before/after（[report.ts:61](evals/runner/report.ts)）。测试集 v0.3 共 **33 例（14 en / 10 id / 9 zh）**。

---

## 7. 工程亮点与面试价值

### 亮点 1：双模型协作 + 事实校验门（用弱模型提自然度，从结构上杜绝编造）

- **对应需求**：印尼语客群要"母语级自然"的回复，但本地小模型容易编造事实、漏价格/日期。
- **代码中如何实现**：`route()` 让分类/工具调用恒走 Claude，`id` 润色走 SEA-LION（[llm-gateway.ts:38](apps/tablet/src/lib/ai/llm-gateway.ts)）；`phraseReply` 让 SEA-LION 只重述 Claude 草稿；`passesGate` 校验"草稿用过的术语锁 + 每个数字"都保留，否则回退草稿（[llm-gateway.ts:99](apps/tablet/src/lib/ai/llm-gateway.ts)）；术语锁来自 `buildGlossaryLocks`（[curation/glossary.ts:169](apps/tablet/src/lib/ai/curation/glossary.ts)）；`mockProvider` + `PHRASE_MOCK_DRIFT` 能离线证明门 + 回退生效。
- **为什么有技术价值**：把"要不要用小模型"从赌博变成**有护栏的工程**——自然度收益归 SEA-LION，正确性底线由 Claude 草稿 + 校验门守住；能力声明（只给 `native_id`、不给 `tool_use`）从类型层面阻止误用。
- **面试官可能追问**：① 校验门用子串/数字匹配，漏检和误伤各在哪？② 为什么不直接让 SEA-LION 端到端回答？③ 千分位 `550,000` vs `550.000` 怎么办？
- **推荐回答思路**：承认门是启发式（同义改写、印尼语数字格式会误伤，评测报告 §6 已记为待办：本地化归一后再比对）；强调"决策/事实单一来源在 Claude"避免小模型幻觉；举 drift 开关作为可证伪设计。

### 亮点 2：流式结构化输出（边流 reply、边拿结构化 intent）

- **对应需求**：语音要"话音未落就回话"（低延迟体感），后端又必须拿结构化 intent 才能分发。二者天然冲突。
- **代码中如何实现**：`streamConversation` 监听 `input_json_delta` 累积工具入参 JSON，`extractReplyProgress` 用手写状态机（处理 `\"`、`\n` 等转义）实时抠 `reply` 增量推 SSE；流结束 `safeParseRespond` 容错解析完整对象（[orchestrator.ts:366/432](apps/tablet/src/lib/ai/orchestrator.ts)）。
- **为什么有技术价值**：在"强制工具调用"的结构化约束下同时拿到流式体验和结构化数据，是对 SDK 能力的深度利用。
- **面试官可能追问**：① 为什么不让模型先流文本、再单独出 JSON？② 转义/多字节在半截 JSON 里怎么不乱码？③ `reply` 不是第一个键或键顺序变了会怎样？
- **推荐回答思路**：强调"单次调用、单一事实来源"避免两段输出不一致；`extractReplyProgress` 按 `"reply"` key 定位、按字符扫描并处理转义，多字节因按 JS 字符串处理不受影响；坦承依赖 `reply` 键存在、但对键顺序不敏感、对字段被拆多个 delta 安全。

### 亮点 3：句级流式语音 + barge-in（把"看得见流式"变成"听得见流式"）

- **对应需求**：老版文字已流式但声音整段合成，客人明显感到停顿；且长回复无法中途打断。
- **代码中如何实现**：`extractSentences` 用 `consumed` 游标增量抽整句（纯函数、可单测），`tts.ts` 句子队列逐句合成播放，`VoiceAssistant` 在第一句到达即进入 `speaking` 并开 barge-in 监听（[sentence-chunker.ts](apps/tablet/src/lib/utils/sentence-chunker.ts)、[tts.ts:59](apps/tablet/src/lib/utils/tts.ts)、[VoiceAssistant.svelte:236](apps/tablet/src/lib/components/VoiceAssistant.svelte)）。
- **为什么有技术价值**：首字节语音延迟从"整段合成时长"降到"第一句合成时长"；队列 + `stopSpeaking` 让打断/结束能干净地清队列并中止在飞的 fetch/audio。
- **面试官可能追问**：① 句子切分对缩写/小数点/中文标点如何鲁棒？② barge-in 如何避免被 TTS 回声误触发？
- **推荐回答思路**：切分用跨语言标点正则 + 最小句长，尾部未完成句留到 `done` 再 flush；barge-in 用带 `echoCancellation` 的麦克风 + 更高的 RMS 阈值 + 连续帧计数抗瞬态。

### 亮点 4：安全由代码保证 + 纵深防御（不 "prompt and pray"）

- **对应需求**：孕妇/高血压不能进禁忌疗程、Nyepi 全岛停摆——这类是安全/合规红线，不能赌模型记得。
- **代码中如何实现**：`validateBooking`（tablet）+ `guardBooking`（MCP）两份分离规则；`CONDITION_ALIASES` 把中/印/英健康表述归一；Saka 历用可审计数据源 `calendar.ts` 逐年维护（[constraints/index.ts](apps/tablet/src/lib/ai/constraints/index.ts)、[spa/constraints.ts](apps/mcp-servers/packages/spa/src/constraints.ts)、[calendar.ts](apps/tablet/src/lib/ai/constraints/calendar.ts)）。
- **为什么有技术价值**：把不可协商的规则从概率性 prompt 移到确定性代码；服务端二次校验实现"不信任客户端"的纵深防御。
- **面试官可能追问**：① 为什么两端各留一份规则而不共享一个包？② 归一化匹配的误报/漏报如何权衡？
- **推荐回答思路**：MCP 侧刻意零跨 app 依赖以保持独立可部署与最小攻击面；匹配偏"宁可拦错也不放过"（block 类），soft warn 类才宽松。

### 亮点 5：评测体系（把"文化更好"从形容词变成可复现的数字，并用它发现能力缺口）

- **对应需求**：判断"文化优化层 + 本地模型路由"到底有没有用、迭代是进步还是退步。
- **代码中如何实现**：`evals/runner` 打真实 SSE 链路，三维打分 + LLM-as-judge（forced tool_choice），env 切 baseline/optimized，`report.ts` 自动生成 before/after 表（[harness.ts](evals/runner/harness.ts)、[judge.ts](evals/runner/judge.ts)、[run-eval.ts](evals/runner/run-eval.ts)、[report.ts](evals/runner/report.ts)）。
- **为什么有技术价值**：**评测的第一价值是发现问题**——它量化出"文化优化只接进 SPA、通用问询在推诿"的覆盖缺口（info-agent 静态兜底），修复后总分从 42.4% 跳到 62.9%（详见 [docs/评测报告.md](docs/评测报告.md)）。
- **面试官可能追问**：① 文化维度用 LLM 判官，如何防判官偏差/漂移？② 为什么打真实链路而非打桩？③ n=33 够不够？
- **推荐回答思路**：记录 judge 模型 + 日期让数字可追溯、建议叠加 ~20% 人工抽检一致性；打真链路才能暴露 MCP 静默失败、info 推诿这类"看代码看不出、真跑才暴露"的坑；坦承 n=33 偏小、已列扩到 ≥50 与补 register/kb 中间档的计划。

### 亮点 6：MCP 作为"人机同源"的后端协议

- **对应需求**：同一批业务能力既给触屏 UI 用，也给 AI Agent 当工具用。
- **代码中如何实现**：业务全部实现为 MCP `server.tool(...)`（Zod schema 同时做校验与工具声明，[spa/tools.ts](apps/mcp-servers/packages/spa/src/tools.ts)）；触屏 `/spa` 页与 AI Agent 都 `callMcpTool` 调，共用 `mcp-client.ts`。
- **为什么有技术价值**：避免"给人一套 REST、给 AI 再包一套 function"的重复维护；工具描述天然是给 LLM 的说明书。
- **面试官可能追问**：① MCP 相比 REST + 手写 function tools 多了什么？② 每请求 new 一个 McpServer 的开销与取舍？
- **推荐回答思路**：讲"协议统一 + 自描述工具"减漂移；对开销诚实——当前无状态换简单，量大时应复用实例或常驻连接。

### 亮点 7：确定性 serviceId 解析器（省一次 LLM 调用）

- **对应需求**：预约链路里已知客人提到某疗程名，只需映射到 id，没必要再花一次模型调用。
- **代码中如何实现**：`resolveSpaServiceId` 拉目录做多信号打分——id/全名强匹配、英文长词分词、**中文 2-gram** 处理"巴厘按摩"vs"传统巴厘按摩"（[spa-agent.ts:181](apps/tablet/src/lib/ai/agents/spa-agent.ts)）。
- **为什么有技术价值**：能确定性解决的从 LLM 手里拿回来，降延迟、降成本、提确定性——**该用规则的地方不硬上模型**。
- **面试官可能追问**：① 打分阈值/权重怎么定、误匹配怎么兜底？② 为什么 2-gram 而非分词？
- **推荐回答思路**：强信号优先、弱信号叠加、取最高分且 >0；中文分词成本高，2-gram 对短名鲁棒；兜底是返回 null 后由上游用 `lastRecommended`/pending 补齐。

> 项目规模决定亮点到此为止——restaurant/transport 域仍是骨架，不硬凑亮点。

---

## 8. 技术难点与解决方案

### 难点 1：既要流式回复、又要结构化意图

- **难点是什么**：一次 LLM 调用同时满足"低延迟逐字回复"与"可靠结构化 intent"。
- **为什么会出现**：强制工具调用保证了结构化，但内容作为工具入参 JSON 流出，天然不是人读文本流。
- **当前代码如何解决**：见亮点 2——增量解析工具 JSON 的 `reply` 字段。
- **方案不足**：强依赖 `reply` 键与 JSON 结构；若模型改结构需同步解析器。
- **下一步优化**：为 `extractReplyProgress`/`safeParseRespond` 补单测锁住行为；或迁 Realtime 语音 API。
- **面试时如何讲**：识别"结构化 vs 流式"冲突→在工具协议下做增量字段解析拿到文字流式→再配句级 TTS 把语音也流式化。

### 难点 2：让弱本地模型提升母语自然度，又不让它编造事实

- **难点是什么**：SEA-LION 母语更自然，但小模型易漏数字、错译专有名词。
- **为什么会出现**：润色是生成式操作，天然可能改动事实。
- **当前代码如何解决**：两阶段——Claude 出含全部事实的草稿，SEA-LION 只重述，`passesGate` 校验术语锁 + 数字，不达标回退草稿（[llm-gateway.ts:74](apps/tablet/src/lib/ai/llm-gateway.ts)）。
- **方案不足**：门是子串/数字启发式；印尼语千分位格式（`550,000` vs `550.000`）过严易误触发回退（评测报告 §6 记为待办）；同义改写可能漏检。
- **下一步优化**：数字本地化归一后再比对；术语锁支持同义/形态变体。
- **面试时如何讲**：我把"用不用小模型"变成有护栏的工程——收益归 SEA-LION、底线归 Claude + 门，并用 `PHRASE_MOCK_DRIFT` 做可证伪验证。

### 难点 3：SEA-LION 默认模型返回空内容（真实踩坑）

- **难点是什么**：连通性自检里样例改写返回空。
- **为什么会出现**：默认 `Qwen-SEA-LION-v4.5-27B-IT` 是**推理模型**，托管 API **无视** `thinking_mode:off`，短提示把 token 全花在隐藏推理、正文为空（`finish_reason=length`、`content=null`）。
- **当前代码如何解决**：默认改用纯 instruct 模型 `Gemma-SEA-LION-v4-27B-IT`，并在 provider 里对 `-R` 模型仍尝试传 `chat_template_kwargs.thinking_mode:off`；把默认值同步进 provider/检查脚本/.env.example 并加注释（[providers/sealion-provider.ts:26](apps/tablet/src/lib/ai/providers/sealion-provider.ts)、[评测报告 §6](docs/评测报告.md)）。
- **方案不足**：依赖托管 API 具体行为，换模型/换 endpoint 需重验。
- **下一步优化**：`scripts/check-sealion.ts` 做启动自检；或自托管 Sahabat-AI 规避限速与行为差异。
- **面试时如何讲**：这是"真跑才暴露"的坑——推理模型 vs instruct 模型在托管 API 上的差异，靠连通性自检脚本快速定位。

### 难点 4：共享 MCP 客户端调用全部静默失败（真实踩坑）

- **难点是什么**：触屏 SPA 首次接 MCP 报 HTTP 406；改 header 后又报 SSE 无法 JSON 解析。此前语音/BFF 的 MCP 调用一直**静默走兜底**，从未真正命中 MCP。
- **为什么会出现**：`callMcpTool` 没发 `Accept: application/json, text/event-stream`，被 `StreamableHTTPServerTransport` 以 406 拒；且该 transport 以 SSE 返回，客户端却按 `res.json()` 解析。
- **当前代码如何解决**：补 `Accept` 头 + 兼容解析 SSE `data:` 帧（`parseSseJsonRpc`）（[mcp-client.ts:40/81](apps/tablet/src/lib/ai/tools/mcp-client.ts)）。
- **方案不足**：兜底逻辑太"安静"，一度掩盖了没打通的事实。
- **下一步优化**：对 MCP 不可达/降级加显式日志与指标，避免静默。
- **面试时如何讲**：兜底是双刃剑——它保住了体验，却掩盖了链路没通；评测打真链路才把它抓出来。

### 难点 5：SPA 预约的时段一致性与会话态并发

- **难点是什么**：多轮增量输入 + 有副作用的写操作，需确认门 + 并发防护。
- **为什么会出现**：语音多轮；预约是写操作。
- **当前代码如何解决**：`spaSession` 逐轮 `mergePending`/`mergeGuest`；`awaitingConfirmation` 确认门；`booking-agent` 与 `spa-repo` 双层校验时段；MCP 侧 `guardBooking` 再兜一层（[booking-agent.ts](apps/tablet/src/lib/ai/agents/booking-agent.ts)、[spa-repo.ts:84](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)）。
- **方案不足**：`spaSession`、`takenSlots`、staff `workOrders` 都是**单进程内存态**——多实例不共享、重启即丢、`pending` 无 TTL；两层校验之间**没有锁**，真并发仍可能超卖。
- **下一步优化**：会话态/工单迁 Redis（项目已有 `@allstay/shared/redis`，注释里也这么写）；下单用事务/唯一约束或 Redis 原子操作。
- **面试时如何讲**：先用内存态快速跑通"多轮 + 确认 + 工单"的产品体验，同时在注释里标明单实例限制和 Redis 迁移路径——是有意识的技术债。

### 难点 6：语音识别在真实环境下的噪声与语种误判

- **难点是什么**：静音/噪声让 Whisper 幻觉字幕腔、误判语种。
- **为什么会出现**：ASR 对低信噪比倾向"编"出高频串。
- **当前代码如何解决**：`/api/stt` 幻觉黑名单 + 去 emoji + 纯标点 + 非目标语种返回空；前端 VAD 丢弃 <500 字节小 blob（[api/stt/+server.ts:7](apps/tablet/src/routes/api/stt/+server.ts)）。
- **方案不足**：黑名单是启发式覆盖不全；RMS/静默阈值是经验值。
- **下一步优化**：置信度/logprob 过滤或服务端 VAD；阈值自适应。
- **面试时如何讲**：多道防线（前端 VAD + 后端黑名单 + 语种兜底），这是真实语音产品的必踩坑。

---

## 9. 当前不足与技术债

### 债 1：认证/会话完全是占位实现

- **问题是什么**：登录、会话校验没真正实现。
- **代码中哪里体现**：[hooks.server.ts:11](apps/tablet/src/hooks.server.ts) 里 `event.locals.staffId = 'staff_from_token'` 且注释 `// TODO: verify token`；[stores/auth.ts](apps/tablet/src/lib/stores/auth.ts) 的 login/logout 多为 TODO；`.env` 的 `SESSION_SECRET`/`STAFF_PIN_SALT` 未被使用。
- **会带来什么影响**：任何持有 cookie 的请求都被视为已登录，无真实鉴权；`/staff` 工单页也无实质保护——生产安全风险高。
- **如何改进**：接真实会话存储（Redis/DB）+ 校验 token；PIN 用盐哈希；给 `/staff` 加角色鉴权。
- **优先级建议**：**高**（安全面广、上线前置；成本中等）。

### 债 2：后端多为占位/未接真实 PMS

- **问题是什么**：真实数据库路径大量 TODO。
- **代码中哪里体现**：`dbRepo` 全部 `throw 'not implemented'`（[spa-repo.ts:137](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)）；dining `place_order` 有 `// TODO: INSERT into cakrasoft_pms`，且把 `staff_id` 当 roomId、`price:0`、名称未从库解析（[dining/tools.ts:79](apps/mcp-servers/packages/dining/src/tools.ts)）；`apps/ai-orchestrator` 仅有 README。
- **会带来什么影响**：`search_menu_items` 直接查 `menu_items` 表，库不存在时依赖 `order-agent` 静态兜底才不崩；下单打印的价格/名称是错的。
- **如何改进**：实现 `dbRepo`、补 orders 落库、`place_order` 用真实 room_id 与从库解析的名称/价格。
- **优先级建议**：**中**（属"未完成"而非"错误设计"，按业务节奏推进）。

### 债 3：会话态/工单在内存，无并发/持久化保障

- **问题是什么**：`spaSession`、`mockRepo.takenSlots`、staff `workOrders` 均为单进程内存态。
- **代码中哪里体现**：[spa-session.ts:29](apps/tablet/src/lib/ai/spa-session.ts)、[spa-repo.ts:41](apps/mcp-servers/packages/spa/src/data/spa-repo.ts)、[staff/notify.ts:21](apps/tablet/src/lib/ai/staff/notify.ts)。
- **会带来什么影响**：多实例/重启丢状态；`pending` 无过期→长期运行内存泄漏；无锁→并发超卖；工单在多实例下不一致。
- **如何改进**：迁 Redis 并加 TTL；下单加原子性保证。注释已写明这一迁移路径。
- **优先级建议**：**中**（demo 无碍，规模化前必修）。

### 债 4：共享类型仍只 en/zh + 印尼语描述缺失

- **问题是什么**：`shared-types` 只支持 `en|zh`，实际全项目用 `en|zh|id`；fixtures 缺 `descId`。
- **代码中哪里体现**：[shared-types/src/index.ts:3](packages/shared-types/src/index.ts) 的 `LocalizedString`/`Language='en'|'zh'`；[spa/fixtures.ts](apps/mcp-servers/packages/spa/src/data/fixtures.ts) 有 `nameId` 无 `descId`，触屏页 `description.id` fallback 到英文（[spa/+page.server.ts:49](apps/tablet/src/routes/spa/+page.server.ts)）。
- **会带来什么影响**：三语在类型层"无名分"，靠各处自定义类型硬撑；印尼语客人看到英文描述。
- **如何改进**：`shared-types` 升级为三语并统一 `LocalizedString`；fixtures 补 `descId`。
- **优先级建议**：**中**（一致性/可维护性，成本中等）。老版"SPA 目录三套分裂"已收敛为单源，这是剩下的尾巴。

### 债 5：SEA-LION 限速 + 校验门数字格式过严

- **问题是什么**：托管 SEA-LION 约 10 次/分限速；`passesGate` 对印尼语千分位格式过严，易误触发回退。
- **代码中哪里体现**：[sealion-provider.ts:19](apps/tablet/src/lib/ai/providers/sealion-provider.ts) 注释 + `EVAL_DELAY_MS`；[llm-gateway.ts:120](apps/tablet/src/lib/ai/llm-gateway.ts) 数字直配；[评测报告 §6](docs/评测报告.md)。
- **会带来什么影响**：评测/生产 sweep 需拉长间隔；本可采纳的 SEA-LION 改写被无谓回退，摊薄本地化收益。
- **如何改进**：数字本地化归一后比对；自托管 Sahabat-AI 规避限速。
- **优先级建议**：**低-中**（取决于印尼语路径的实际使用比例）。

### 债 6：自动化测试集中在端到端评测，缺纯函数单测

- **问题是什么**：已有一套很好的**端到端评测**（`evals/`），但 `extractReplyProgress`、`extractSentences`、`resolveSpaServiceId`、`passesGate`、`validateBooking` 这类复杂纯函数**没有单测**；`package.json` 无 `test` 脚本（[package.json:11](package.json)）。
- **代码中哪里体现**：仓库无 `*.test.ts`；上述纯函数注释里多写着"pure + stateless，便于单测"，但单测尚未补。
- **会带来什么影响**：评测能抓端到端回归，但纯函数的边界 bug（转义、切句、打分阈值）缺快速回归保护，重构风险高。
- **如何改进**：给纯函数补 vitest 单测（这些函数刻意设计成无副作用，正是为此）；加 `test` 脚本到 CI。
- **优先级建议**：**中**（对高复杂纯函数收益最大；相比老版"几乎无测试"已大幅改善）。

---

## 10. 可继续开发的高价值方向

> 以下均为**建议**，非已实现。区分度：带"建议/可"字样。

1. **补齐鉴权与会话（上线前置）**：真实 token 校验、PIN 加盐、会话态入 Redis，并给 `/staff` 加角色鉴权。
2. **会话态/工单入 Redis 并加并发保障**：消除单实例限制与超卖风险（注释已铺好路径）。
3. **接真实 Cakrasoft PMS**：实现 `dbRepo`、订单落库、打印用真实价格/名称、`place_order` 用真实 room_id。
4. **三语类型统一 + 补印尼语描述**：`shared-types` 升三语，fixtures 补 `descId`。
5. **校验门本地化归一**：数字/术语按印尼语格式归一后比对，让 SEA-LION 改写更多被采纳。
6. **补纯函数单测 + 扩评测集**：单测锁住 `extractReplyProgress`/`extractSentences`/`resolveSpaServiceId`/`passesGate`；测试集扩到 ≥50、补 register/kb 中间档、加 ~20% 人工抽检一致性。
7. **把 orchestrator 抽成独立服务**（architecture.md 的 Phase 4）：当前内嵌 SvelteKit，抽出后可独立扩缩容、被多端复用。
8. **文化 KB 升级为向量检索**：接口已预留，规模变大时替换 `retrieveCulturalFacts`/`selectGlossary` 内部实现而不改调用方。
9. **语音进一步低延迟**：评估迁 Realtime 语音 API，把 STT/LLM/TTS 合到一条流。

---

## 11. 面试讲述稿（可直接口述，约 520 字）

> AllStay 是我参与的一套巴厘岛酒店客房平板服务系统，有触屏点单和一个常驻的多语言语音管家两条动线，我主要在语音和 AI 编排这条线上。
>
> 整体是 monorepo：前端 SvelteKit 同时充当 BFF；后端没写传统 REST，而是把每个业务域做成 MCP 服务，业务能力以"AI 可调用的工具"形式暴露——同一套工具，触屏页和 AI Agent 共用，不用维护两套接口。
>
> 语音链路是：唤醒词 + 前端 VAD 断句 → Whisper 转写 → Claude 意图识别 → 分发到域 Agent 调 MCP → 分句合成播报。我最想讲三个技术点。**第一是流式结构化输出**：我用 Claude 的强制工具调用拿到 `{intent, entities, reply}` 结构化结果，但内容是作为工具入参 JSON 流出的，我写了增量解析器一边累积 JSON、一边只把 `reply` 字段的新增字符抠出来推给前端逐字显示——同时拿到结构化意图和流式体验。**第二是句级流式语音**：前端每收到一段就抽出完成的整句立即入 TTS 队列，语音第一句就开始播，还支持说话打断，把"看得见流式"变成"听得见流式"。**第三是双模型协作**：印尼语回复我让 SEA-LION 这个东南亚本地模型来润色，但决策和事实全在 Claude 的草稿里，我加了一道校验门，检查润色结果保留了所有数字和锁定术语，不达标就回退 Claude 草稿——用弱模型提自然度，同时从结构上杜绝它编造事实。
>
> 安全上，孕期禁忌、Nyepi 静居日这些红线我放在代码里硬校验，而不是靠 prompt，而且 tablet 和 MCP 服务端各校验一遍做纵深防御。
>
> 我还搭了一套评测体系，打运行中的真实链路、用 LLM 判官三维打分，输出 before/after。它最大的价值是**发现问题**——量化出"文化优化只接进了 SPA、通用问询在推诿"这个覆盖缺口，修完总分从 42% 跳到 63%。
>
> 已知技术债主要是会话态还在内存、鉴权是占位，我在注释里标了 Redis 和鉴权的迁移路径——是有意识的取舍，不是疏忽。

---

## 12. 代码证据索引

| 结论 / 论断 | 代码位置 |
| --- | --- |
| 强制工具调用拿结构化输出 | `orchestrator.ts:302-325`（RESPOND_TOOL）、`334/349`（extract/safeParse） |
| 流式增量抠 reply 字段 | `orchestrator.ts:366-398`（extractReplyProgress）、`432-476`（streamConversation） |
| 意图分发 switch + 印尼语本地化挂载 | `orchestrator.ts:122-292`（dispatchParsed）、`419-428`（localize） |
| 模型路由（Claude 推理 / SEA-LION 润色） | `llm-gateway.ts:38-54`（route） |
| 两阶段本地化 + 校验门 + 回退 | `llm-gateway.ts:74-125`（phraseReply, passesGate） |
| Provider 抽象 + 能力声明 | `providers/provider.ts`、`anthropic-provider.ts`、`sealion-provider.ts:57`（只 native_id）、`mock-provider.ts`（drift 开关） |
| 句级流式 TTS | `sentence-chunker.ts:28`（extractSentences）、`tts.ts:52-72`（队列）、`VoiceAssistant.svelte:236-288` |
| barge-in 打断 | `VoiceAssistant.svelte:149-207`（startBargeMonitor/onBargeIn） |
| 代码级安全约束（tablet） | `constraints/index.ts:100-187`（validateBooking）、`calendar.ts:18-47` |
| 服务端二次安全校验（纵深防御） | `mcp-servers/packages/spa/src/constraints.ts:52-77`（guardBooking）、`tools.ts:54-87` |
| 术语锁定 + 文化检索 + few-shot | `curation/index.ts:62`、`glossary.ts:135-185`（locks）、`fewshot.ts` |
| SPA Agentic 工具循环（只读白名单） | `agents/spa-agent.ts:93-168`（MAX_HOPS=4） |
| 确定性 serviceId 解析（中文 2-gram） | `agents/spa-agent.ts:181-214`（resolveSpaServiceId） |
| 两步预约 propose/confirm | `agents/booking-agent.ts:68-280` |
| 员工工单桥（wrap, don't replace） | `staff/work-order.ts`（buildWorkOrder）、`staff/notify.ts`（多渠道）、`routes/staff/+page.server.ts` |
| 跨轮健康画像累积 | `ai/spa-session.ts:47-61`（mergeGuest） |
| MCP 客户端 + Accept 头 + SSE 解析（修静默失败） | `ai/tools/mcp-client.ts:40-95` |
| 触屏 SPA 页单源（走 MCP） | `routes/spa/+page.server.ts:29-58` |
| Redis 购物车 TTL 1h | `mcp-servers/packages/shared/src/redis.ts` |
| dining 真实 SQL + place_order TODO | `mcp-servers/packages/dining/src/tools.ts:19-31, 79-104` |
| 点餐静态兜底 | `agents/order-agent.ts:22-111, 137-192` |
| STT 幻觉过滤 | `routes/api/stt/+server.ts:7-32, 55-74` |
| 评测：打真实链路 | `evals/runner/harness.ts:20`（runTurn, SSE） |
| 评测：LLM-as-judge（forced tool_choice） | `evals/runner/judge.ts:26-84` |
| 评测：三维打分 + before/after | `evals/runner/run-eval.ts:52-141`、`report.ts:61-89`、`evals/results/summary.md` |
| 评测发现能力缺口（info 推诿→接地） | `docs/评测报告.md §6`、`agents/info-agent.ts:38-79` |
| 认证占位 | `hooks.server.ts:9-14`、`stores/auth.ts` |
| 共享类型只支持 en/zh | `packages/shared-types/src/index.ts:3-8` |
| SpaRepo mock/db 切换（db 未实现） | `mcp-servers/packages/spa/src/data/spa-repo.ts:137-156` |

---

## 13. 给后续 AI 笔记系统的导入提示

**建议沉淀为知识卡片的知识点（每条一句话）：**

1. 用 Anthropic 强制工具调用（`tool_choice`）可把 LLM 输出约束成 schema 化对象，替代脆弱的自由文本 JSON 解析；judge 也可复用同一纪律。
2. 强制工具调用时内容以 `input_json_delta` 流出，可增量解析特定字段（处理转义）实现"结构化 + 流式"兼得。
3. 句级流式 TTS = 增量抽整句 + 顺序合成队列，把首字节语音延迟从"整段合成"降到"第一句合成"，并配可打断的 barge-in。
4. 双模型协作："强模型出含事实草稿 + 弱本地模型只润色 + 校验门验证数字/术语 + 不达标回退"，用弱模型提自然度而不牺牲正确性。
5. 能力声明（capabilities：给 native_id 不给 tool_use）可从类型层面阻止把弱模型误用于决策。
6. 安全/合规红线应由**代码**硬校验而非 prompt，且客户端 + 服务端**双端校验**做纵深防御；日期敏感规则用可审计数据源逐年维护。
7. Prompt 分层：register（怎么说，固定）+ 检索事实 + 术语锁（可被下游机器校验）是低成本、可验证的 RAG 雏形。
8. MCP 让业务能力以自描述工具形式暴露，同时服务人类前端与 AI Agent，避免双份接口；注意每请求实例化的开销。
9. 能用确定性规则解决的匹配（名称→id）不必调 LLM；中文可用 2-gram 匹配。
10. 有副作用的写操作应设"确认门"+ 并发/持久化保护；内存态要明确其单实例局限并预留 Redis 迁移路径。
11. 评测的第一价值是**发现能力缺口**（不是调参）；打运行中的真实链路 + LLM-as-judge + before/after 表，能暴露"看代码看不出、真跑才现"的坑（MCP 静默失败、通用问询推诿）。
12. 端到端评测≠单测：纯函数应刻意设计成无副作用（cursor 传入传出），以便补快速回归单测。

**建议标签/分类**：`#LLM应用` `#AnthropicClaude` `#SEA-LION` `#模型路由` `#工具调用` `#流式输出` `#流式TTS` `#MCP` `#RAG` `#术语锁定` `#安全约束` `#纵深防御` `#SvelteKit` `#语音交互` `#Agent架构` `#LLM评测` `#技术债治理`

**可延伸的复习问题：**

- 如何在一次 LLM 调用里同时获得可靠结构化意图和逐字流式回复？把语音也流式化还需要什么？
- 想用东南亚本地模型提升印尼语自然度，怎样从结构上保证它不编造事实/漏价格？校验门的漏检与误伤各在哪？
- 为什么安全红线要放代码而非 prompt？为什么还要在 MCP 服务端再校验一遍？两份规则该不该共享一个包？
- 语音预约这类多轮 + 副作用场景，如何设计会话态、确认门与并发防护？内存态迁 Redis 要注意什么？
- 评测体系为什么要打运行中的真实链路而非打桩？LLM-as-judge 如何防判官偏差？它是怎么帮你发现"覆盖缺口"而非"调参问题"的？
- 一个项目 README/老文档与代码不符时，你会用什么方法快速判断"真实能力边界"？（本项目 README/老分析多处已被实现超越）
