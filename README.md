# ezuwebs.net

## English

This repository is organized as a TypeScript monorepo for an interactive AI coding workspace. The text documents in [docs/txt](docs/txt) describe both the current product idea and a proposed rebuild direction.

At a high level, the repo is about turning AI output into executable development actions instead of plain chat responses. The intended system combines:

- a chat-driven user interface,
- structured planning and action protocols,
- browser or remote runtime execution,
- code, terminal, preview, and interaction panels,
- multi-model routing for planning, coding, review, and summarization.

### What the TXT documents cover

- [docs/txt/repo-overview-and-implementation-zh.txt](docs/txt/repo-overview-and-implementation-zh.txt)
  Explains the overall product goal: an AI coding workbench that can generate, modify, run, and preview projects rather than only answer questions.

- [docs/txt/repo-explanation-zh.txt](docs/txt/repo-explanation-zh.txt)
  Describes the current architecture in detail, including the chat flow, prompt protocol, parser, action runner, WebContainer integration, workbench state, and history persistence.

- [docs/txt/rebuild-architecture-and-mvp-zh.txt](docs/txt/rebuild-architecture-and-mvp-zh.txt)
  Proposes the rebuild structure as a restrained monorepo with `apps` and `packages`, and lays out the MVP implementation order.

- [docs/txt/model-routing-and-prompt-layering-zh.txt](docs/txt/model-routing-and-prompt-layering-zh.txt)
  Defines why the system should route different tasks to different models, and how prompt layers should stay modular and maintainable.

- [docs/txt/database-and-event-protocol-zh.txt](docs/txt/database-and-event-protocol-zh.txt)
  Outlines the data model and event protocol needed for recoverable sessions, traceable execution, approvals, runtime updates, and future extensibility.

- [docs/txt/frontend-information-architecture-and-interaction-flow-zh.txt](docs/txt/frontend-information-architecture-and-interaction-flow-zh.txt)
  Defines the frontend information architecture and interaction flows, emphasizing that the product should expose plan state, user decisions, execution progress, and real runtime results.

### Combined takeaway

Taken together, these documents describe a product with this core idea:

`natural language intent -> structured plan -> executable actions -> runtime execution -> visible project state`

The target experience is not just AI-assisted chat. It is an interactive AI software-building environment where users can see what the agent plans to do, control risky decisions, inspect file changes, run commands, and verify the result in a live preview.

## 中文

这个仓库采用 TypeScript monorepo 结构，目标是构建一个交互式 AI 编程工作台。现在已将相关说明文档统一整理到 [docs/txt](docs/txt) 目录，这些文档一起描述了当前产品思路，以及下一版重构的方向。

从整体上看，这个项目关注的不是普通聊天，而是把 AI 输出变成可执行的开发动作。它想组合出这样一套系统：

- 以聊天为入口的交互界面，
- 结构化的计划与动作协议，
- 浏览器运行时或远程运行时，
- 代码、终端、预览、交互面板，
- 面向规划、编码、审查、摘要的多模型路由。

### 这些 TXT 文档分别讲什么

- [docs/txt/repo-overview-and-implementation-zh.txt](docs/txt/repo-overview-and-implementation-zh.txt)
  从高层解释仓库要解决的问题，以及它为什么本质上是一个 AI 编程工作台，而不是普通聊天应用。

- [docs/txt/repo-explanation-zh.txt](docs/txt/repo-explanation-zh.txt)
  详细拆解当前架构，包括聊天链路、prompt 协议、流式解析器、动作执行器、WebContainer、Workbench 状态管理和历史持久化。

- [docs/txt/rebuild-architecture-and-mvp-zh.txt](docs/txt/rebuild-architecture-and-mvp-zh.txt)
  提出下一版重构的目录结构、核心模块边界、共享类型设计，以及 MVP 的开发顺序。

- [docs/txt/model-routing-and-prompt-layering-zh.txt](docs/txt/model-routing-and-prompt-layering-zh.txt)
  说明为什么要做多模型分工，以及 prompt 应该如何分层，避免把所有职责堆到一个模型和一份提示词里。

- [docs/txt/database-and-event-protocol-zh.txt](docs/txt/database-and-event-protocol-zh.txt)
  给出数据库结构和事件流协议的设计方向，用于支持会话恢复、执行追踪、审批节点、运行时状态同步和后续扩展。

- [docs/txt/frontend-information-architecture-and-interaction-flow-zh.txt](docs/txt/frontend-information-architecture-and-interaction-flow-zh.txt)
  说明前端应该如何组织信息和交互，让用户不仅能提需求，也能看到计划、参与决策、跟踪执行、验证最终结果。

### 合并后的核心结论

这些文档合起来定义了一条主线：

`自然语言需求 -> 结构化计划 -> 可执行动作 -> 运行时执行 -> 可见的项目状态`

也就是说，这个仓库的目标不是“AI 给出建议”，而是“AI 与用户共同完成软件构建过程”。用户应该能看到 AI 准备做什么、控制关键节点、检查代码和命令执行结果，并在真实预览中验证产出。
