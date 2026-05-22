# Focus Chat 工程树

## 项目在做什么

`focusChat` 是一个基于 `Next.js 16 + React 19 + TypeScript + Tailwind CSS` 的陪伴型聊天 Demo。

它的核心目标不是做“知识问答”，而是做一个偏“陪伴 / 情绪承接 / 低刺激输出”的对话系统：

- 前端提供微信风格聊天界面
- 后端通过 `App Router` 的 `route.ts` 暴露聊天 API
- 模型侧目前接的是 DeepSeek（通过 OpenAI SDK 兼容调用）
- 响应通过 `SSE` 流式返回，前端逐条接收并展示
- 对话风格由 `soul`、`topic-pool`、`user-profile`、`cognitive-state` 等文本素材辅助约束
- 项目里已经有一套“观察用户状态”的 `observation` 模块，但当前主聊天链路里还没有完整接入

一句话概括：

这是一个“用大模型做低压陪聊体验”的全栈 Next.js 项目。

---

## 工程树

```text
focusChat/
├─ AGENTS.md                         # 代理工作说明；强调这个项目使用的 Next.js 版本和旧认知不同
├─ CLAUDE.md                         # 额外协作说明（当前内容很少）
├─ README.md                         # 项目介绍，部分结构说明已落后于当前代码
├─ package.json                      # 项目依赖与脚本
├─ package-lock.json
├─ tsconfig.json                     # TS 配置，定义 @/* -> src/* 别名
├─ next.config.ts                    # Next.js 配置，目前几乎为空
├─ eslint.config.mjs                 # ESLint 配置
├─ postcss.config.mjs                # PostCSS 配置
├─ public/                           # 静态资源
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ src/
│  ├─ app/                           # Next.js App Router 入口
│  │  ├─ favicon.ico
│  │  ├─ globals.css                 # 全局样式，含微信风格色值和滚动条样式
│  │  ├─ layout.tsx                  # 根布局，挂载字体、metadata、viewport
│  │  ├─ page.tsx                    # 首页，直接渲染 ChatContainer
│  │  └─ api/
│  │     ├─ chat/
│  │     │  ├─ route.ts              # 旧版聊天 API：基础 prompt + DeepSeek 流式输出
│  │     │  └─ v2/
│  │     │     └─ route.ts           # 主聊天 API：素材检索 + Soul Prompt + 多条消息输出 + pause 控制
│  │     └─ test/
│  │        └─ route.ts              # DeepSeek 连通性测试接口
│  ├─ components/                    # 前端聊天 UI 组件
│  │  ├─ ChatContainer.tsx           # 聊天主容器；管理消息、SSE、状态、暂停逻辑
│  │  ├─ MessageBubble.tsx           # 单条消息气泡
│  │  ├─ MessageInput.tsx            # 输入框；输入时触发 pause，回车发送
│  │  └─ TypingIndicator.tsx         # “对方正在输入”动画
│  ├─ data/                          # Prompt 与状态素材
│  │  ├─ cognitive-state.md          # 用户认知状态描述素材
│  │  ├─ soul.md                     # 风格设定素材
│  │  ├─ topic-pool.md               # 话题池原始文本
│  │  ├─ user-profile.md             # 用户画像素材
│  │  └─ user-state.json             # observation 模块持久化的用户状态
│  ├─ lib/                           # 核心业务逻辑
│  │  ├─ logger.ts                   # 统一日志输出
│  │  ├─ prompts.ts                  # Phase 1/3 的系统 Prompt 与状态 Prompt
│  │  ├─ soul.ts                     # Soul 风格 Prompt 常量
│  │  ├─ topic-pool.ts               # 解析 topic-pool.md，提供检索/随机选题能力
│  │  └─ observation/                # “观察用户状态”的分析模块
│  │     ├─ index.ts                 # observation 总入口：构建输入、调 LLM、更新状态
│  │     ├─ parser.ts                # 解析 observation 的 JSON 输出
│  │     ├─ prompt.ts                # observation 专用 prompt 构建
│  │     ├─ scorer.ts                # 将 observation 结果映射到用户状态
│  │     ├─ types.ts                 # observation 内部类型
│  │     └─ updateState.ts           # 读写 user-state.json
│  └─ types/
│     └─ index.ts                    # 全局业务类型：消息、SSE 事件、Topic、状态等
└─ node_modules/                     # 依赖目录；含 next/dist/docs 官方文档
```

---

## 按职责拆分

### 1. 页面层

- `src/app/page.tsx`
  - 首页没有复杂路由逻辑
  - 只负责挂载聊天容器

- `src/app/layout.tsx`
  - 负责全局字体、页面元信息、viewport
  - 是标准的 App Router 根布局

### 2. 前端交互层

- `src/components/ChatContainer.tsx`
  - 这是前端主控制器
  - 保存消息数组、加载状态、SSE 状态
  - 发送请求到 `/api/chat/v2`
  - 解析后端 SSE 事件并更新 UI
  - 输入时会请求后端执行 `pause`

- `src/components/MessageInput.tsx`
  - 管理输入框本地状态
  - `Enter` 发送，`Shift + Enter` 换行
  - 用户刚开始重新输入时会触发 `onInput`

- `src/components/MessageBubble.tsx` / `TypingIndicator.tsx`
  - 负责 UI 呈现
  - 基本是纯展示组件

### 3. API 与模型调用层

- `src/app/api/chat/route.ts`
  - 旧版接口
  - 直接把历史消息 + 简化系统提示词发给 DeepSeek
  - 按 token 流式输出

- `src/app/api/chat/v2/route.ts`
  - 当前实际主链路
  - 读取用户画像、认知状态、话题素材
  - 选择话题后拼装 Prompt
  - 要求模型输出 JSON
  - 把 JSON 解析成 1 到多条消息
  - 再通过 SSE 分条发送给前端
  - 内建 `pause` 机制

- `src/app/api/test/route.ts`
  - 单独用来验证 DeepSeek API key 和调用是否正常

### 4. Prompt / 素材层

- `src/data/soul.md`
  - 长文本风格设定
  - 目标是把回复拉向“情绪感知 + 具体叙述”的陪伴式表达

- `src/data/topic-pool.md`
  - 预设话题素材池
  - 目前由 `src/lib/topic-pool.ts` 解析

- `src/data/user-profile.md`
  - 用户画像
  - 被注入到 v2 Prompt 中

- `src/data/cognitive-state.md`
  - 额外的认知状态描述
  - 也会被注入到 v2 Prompt 中

### 5. 状态观察层

- `src/lib/observation/*`
  - 这是一个相对独立的小系统
  - 目标是根据用户最新输入、最近几轮对话、AI 上一条输出，判断：
    - 用户当前认知活跃度
    - 是否在打断 AI
    - 是否愿意继续表达
    - AI 是否太啰嗦
  - 最后把结果写回 `src/data/user-state.json`

目前观察：

- 这部分已经具备“读取状态 -> 调 LLM -> 解析 -> 评分 -> 持久化”的完整骨架
- 但当前 `chat/v2` 还没有显式调用它
- 所以它更像“预备接入中的状态机基础设施”

---

## 当前主数据流

```text
用户输入
  -> ChatContainer.tsx
  -> POST /api/chat/v2
  -> route.ts 读取消息历史 + data 素材
  -> topic-pool.ts 选取话题
  -> 拼接 Soul Prompt
  -> 调用 DeepSeek
  -> 模型输出 JSON messages
  -> API 转成 SSE 事件
  -> ChatContainer 逐条接收
  -> MessageBubble 渲染到页面
```

如果用户重新开始输入：

```text
MessageInput onInput
  -> POST /api/chat/v2 { action: "pause" }
  -> 后端 AbortController 中断当前输出
```

---

## 目前能看出的项目阶段

从代码状态看，这个项目处在“Demo 已可运行，结构正在从简单聊天升级为状态化陪聊系统”的阶段：

- 已完成：
  - 单页聊天界面
  - SSE 流式输出
  - DeepSeek 接入
  - 基于素材池和 Soul Prompt 的风格化回复
  - 基本暂停机制

- 正在演进：
  - observation 状态分析
  - 更明确的用户状态机
  - 更细的输出节奏控制

- 还没完全收口的地方：
  - README 结构与真实代码不完全一致
  - `prompts.ts` 中有些 Phase 3 设计尚未接入主流程
  - `observation` 模块已存在，但未成为 `v2` 的正式前置步骤

---

## 结论

如果后面要继续维护这个项目，可以先把它理解成 4 层：

1. `app/ + components/` 是聊天 UI 和 API 出入口
2. `lib/topic-pool.ts + data/*.md` 是回复素材系统
3. `api/chat/v2/route.ts` 是当前真正的业务核心
4. `lib/observation/*` 是下一阶段准备接入的“用户状态感知层”

这也是这个项目最值得优先阅读的顺序。
