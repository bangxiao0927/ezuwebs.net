# ezuwebs.net

## English

This repository is organized as a TypeScript monorepo for an interactive AI coding workspace. The reference notes live under `docs/txt`, but the important part is the architecture they describe as a whole.

At a high level, the repo is about turning AI output into executable development actions instead of plain chat responses. The intended system combines:

- a chat-driven user interface,
- structured planning and action protocols,
- browser or remote runtime execution,
- code, terminal, preview, and interaction panels,
- multi-model routing for planning, coding, review, and summarization.

### What the reference notes cover

The notes cluster around six themes:

- Product framing
  The repository is not trying to be a chat UI with code snippets. It is aiming at an AI software workspace that can plan, edit files, run commands, and surface the result as a live project state.

- Current-system explanation
  The existing direction is described as a chain from prompt protocol to streamed parsing, action execution, runtime integration, and workbench state synchronization.

- Rebuild plan
  The next version is framed as a restrained monorepo with `apps` and `packages`, where protocol, core logic, runtime adapters, model gateway, and UI stay clearly separated.

- Model routing and prompt layering
  Different tasks should go to different model roles, with planning, coding, review, and summarization treated as separate responsibilities instead of one default model doing everything.

- Database and event protocol
  Sessions, plans, actions, approvals, runtime updates, and file changes should be captured through a recoverable data model and a shared event stream contract.

- Frontend information architecture
  The UI should expose the agent's plan, pending decisions, execution timeline, file state, preview state, and block-level editing controls instead of hiding them behind a plain chat flow.

### Combined takeaway

Taken together, these documents describe a product with this core idea:

`natural language intent -> structured plan -> executable actions -> runtime execution -> visible project state`

The target experience is not just AI-assisted chat. It is an interactive AI software-building environment where users can see what the agent plans to do, control risky decisions, inspect file changes, run commands, and verify the result in a live preview.

## 中文

这个仓库采用 TypeScript monorepo 结构，目标是构建一个交互式 AI 编程工作台。相关说明文档统一整理在 `docs/txt` 目录，但更重要的是它们共同定义出来的整体架构思路。

从整体上看，这个项目关注的不是普通聊天，而是把 AI 输出变成可执行的开发动作。它想组合出这样一套系统：

- 以聊天为入口的交互界面，
- 结构化的计划与动作协议，
- 浏览器运行时或远程运行时，
- 代码、终端、预览、交互面板，
- 面向规划、编码、审查、摘要的多模型路由。

### 这些文档主要覆盖什么

这些文档大体可以归纳成六组主题：

- 产品定位
  仓库的目标不是“聊天加代码片段”，而是一个可以规划、改文件、执行命令、运行预览的 AI 软件工作台。

- 现有思路拆解
  当前方向被描述成一条完整链路：prompt 协议、流式解析、动作执行、运行时接入、Workbench 状态同步。

- 重构方案
  下一版被规划为克制的 monorepo，明确拆出 `apps` 和 `packages`，让协议、核心逻辑、运行时适配、模型网关、UI 分层清楚。

- 模型路由与 prompt 分层
  规划、编码、审查、摘要应分别交给不同职责的模型角色，而不是永远把所有事都塞给一个默认模型。

- 数据与事件协议
  会话、计划、动作、审批、运行时更新、文件变化，都应该通过可恢复的数据模型和共享事件流协议来表达。

- 前端信息架构
  UI 不应该只剩一个聊天入口，而是要把计划、待确认事项、执行时间线、文件状态、预览状态，以及 block 级网页编辑入口都显式展示出来。

### 合并后的核心结论

这些文档合起来定义了一条主线：

`自然语言需求 -> 结构化计划 -> 可执行动作 -> 运行时执行 -> 可见的项目状态`

也就是说，这个仓库的目标不是“AI 给出建议”，而是“AI 与用户共同完成软件构建过程”。用户应该能看到 AI 准备做什么、控制关键节点、检查代码和命令执行结果，并在真实预览中验证产出。
