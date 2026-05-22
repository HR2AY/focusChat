# Focus Chat

一个"反向输出型 / 唤醒调节型"对话系统，基于 Next.js + TypeScript + Tailwind CSS + DeepSeek。

## 核心特性

- 微信风格聊天界面
- 流式输出，逐字显示
- 短句、低抽象的对话风格
- 文艺感和克制感
- **双层 Agent 系统**（Phase 2）
- **Soul 风格系统**（蔡康永+大冰）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.env.local` 文件，填入你的 DeepSeek API Key。若要启用语音转文字，也同时配置 BigModel API Key：

```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
BIGMODEL_API_KEY=your-bigmodel-api-key
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
focusChat/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── chat/route.ts         # 旧版聊天 API
│   │   │   ├── chat/v2/route.ts      # 新版双层 Agent API
│   │   │   └── test/route.ts         # API 测试端点
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/                   # React 组件
│   │   ├── ChatContainer.tsx         # 聊天主容器
│   │   ├── MessageBubble.tsx         # 消息气泡
│   │   ├── MessageInput.tsx          # 输入框
│   │   └── TypingIndicator.tsx       # 打字动画
│   ├── lib/                          # 核心逻辑
│   │   ├── agents/
│   │   │   ├── topic-loader.ts       # 主 Agent：话题加载器
│   │   │   ├── message-emitter.ts    # AgentA：消息发射器
│   │   │   └── intent-analyzer.ts    # AgentB：意图分析器
│   │   ├── topic-pool.ts             # 话题池
│   │   ├── logger.ts                 # 日志工具
│   │   ├── prompts.ts                # Prompt 模板
│   │   └── soul.ts                   # Soul 风格系统
│   └── types/                        # TypeScript 类型
│       └── index.ts
├── .env.local                        # 环境变量
├── package.json
└── README.md
```

## Soul 风格系统

融合**蔡康永**（情感、情绪）+ **大冰**（具体事件逻辑）的说话风格。

### 蔡康永的部分：懂情绪

- 从不讲大道理，只关注对方的感受
- 用具体的意象代替抽象的道理
- 短句，像在心里默念
- 不评价，只感受

### 大冰的部分：讲具体的事

- 讲故事，不讲道理
- 有画面感，像在讲故事
- 口语化，不书面
- 有节奏感，像在打鼓

### 示例

**用户说：今天好累**

❌ AI回答：那你应该好好休息一下，明天会更好的。

✅ Soul回答：
> 累的时候，连呼吸都觉得多余。
> 我以前加班到凌晨三点，走出公司的时候，天都亮了。
> 你呢？今天做了什么？

## 双层 Agent 系统（Phase 2）

### 架构

```
用户输入 → AgentB (意图分析) → 调度 → AgentA (输出) / 主Agent (搜索)
```

### 三个角色

| 角色 | 名称 | 职责 |
|------|------|------|
| 主 Agent | TopicLoader | 话题加载器，检索话题池或联网搜索，加载600字语料 |
| AgentA | MessageEmitter | 消息发射器，拆解为短句，逐条发送，带emoji |
| AgentB | IntentAnalyzer | 意图分析器，侦测用户意图，调度其他Agent |

### 预设话题

- 蔡康永的经典语录
- 澳大利亚旅游奇遇
- 降低皮质醇邪修
- 海上钢琴师名句

## 技术栈

- **前端**: Next.js 16, React, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes
- **AI**: DeepSeek V4 Flash
- **流式**: Server-Sent Events (SSE)

## 开发计划

### Phase 1 ✅
- [x] 项目初始化
- [x] 微信风格聊天 UI
- [x] API 路由 + DeepSeek 流式调用
- [x] 基础 Prompt

### Phase 2 ✅
- [x] 话题池（4个预设话题）
- [x] 主 Agent - 话题加载器
- [x] AgentA - 消息发射器
- [x] AgentB - 意图分析器
- [x] 新版 API 路由
- [x] 前端支持暂停控制
- [x] Soul 风格系统

### Phase 3 (计划中)
- [ ] 状态机 (HIGH/MID/LOW/PRE_SLEEP)
- [ ] 记忆系统
- [ ] 复杂度递减
- [ ] 轻打断机制
- [ ] 困倦式收束

## 注意事项

- 本项目是 demo 质量，不是完整生产系统
- 对话状态保存在内存中，刷新页面会丢失
- 需要有效的 DeepSeek API Key 才能使用

## License

MIT
