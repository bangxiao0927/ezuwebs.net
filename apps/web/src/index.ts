import { applyAgentEvent, createSessionState } from "@ezu/core";
import {
  centerWorkspacePanels,
  rightWorkbenchPanels,
  workspacePanelLabels,
} from "@ezu/ui";
import { type ActionState, type AgentEvent, type PendingInteraction } from "@ezu/protocol";

export { createReplacementPrompt } from "./replacement.js";

export type PatchActionState = ActionState & {
  action: Extract<ActionState["action"], { type: "file.patch" }>;
};

export interface WebAppShellConfig {
  projectName: string;
  runtimeType: "browser" | "remote";
}

export interface WebAppBootstrap {
  config: WebAppShellConfig;
  initialEvents: AgentEvent[];
  sessionId: string;
  projectId: string;
  webEditor?: Partial<InteractiveWebEditorState>;
  selectedDiffActionId?: string;
  composerText?: string;
  activeFile?: string;
  viewMode?: ViewMode;
}

export type ViewMode = "layout" | "code" | "preview";

export interface WorkbenchViewModel {
  chatMessages: Array<{ id: string; role: string; content: string }>;
  plan: WebAppEventState["plan"];
  actions: WebAppEventState["actions"];
  pendingInteraction: WebAppEventState["pendingInteraction"];
  files: string[];
  previews: WebAppEventState["runtime"]["openPorts"];
  webEditor: InteractiveWebEditorState;
  selectedBlock?: WebEditorBlock;
  selectedBlockFile?: string;
  patchActions: PatchActionState[];
  selectedDiffAction?: PatchActionState;
  approvalDecision?: ApprovalDecisionState;
}

export interface ApprovalDecisionState {
  status: "approved" | "rejected";
  title: string;
  summary: string;
  rejectionReason?: string;
  followUpStrategy?: "revise" | "replace_structure";
}

export interface WebAppEventState {
  messages: ReturnType<typeof createSessionState>["messages"];
  plan: ReturnType<typeof createSessionState>["plan"];
  actions: ReturnType<typeof createSessionState>["actions"];
  pendingInteraction: ReturnType<typeof createSessionState>["pendingInteraction"];
  runtime: ReturnType<typeof createSessionState>["runtime"];
  approvalDecision?: ApprovalDecisionState;
}

export interface WebEditorBlock {
  id: string;
  label: string;
  selector: string;
  html: string;
  notes?: string;
}

export interface WebEditorProperty {
  key: string;
  label: string;
  value: string;
}

export interface WebEditorSelection {
  blockId: string;
  path: string;
}

export interface InteractiveWebEditorState {
  selectedBlockId?: string;
  blocks: WebEditorBlock[];
  properties: WebEditorProperty[];
  lastIntent?: string;
  suggestedPrompt?: string;
}

export interface InteractiveWebEditRequest {
  selection: WebEditorSelection;
  intent: string;
  patchStrategy: "replace" | "append" | "refine";
  properties?: WebEditorProperty[];
}

export interface InteractiveWebEditResponse {
  nextState: InteractiveWebEditorState;
  suggestedPrompt: string;
}


export function reduceWorkbenchEvents(
  input: Pick<WebAppBootstrap, "initialEvents" | "projectId" | "sessionId">,
): WebAppEventState {
  let session = createSessionState({
    id: input.sessionId,
    projectId: input.projectId,
  });
  let approvalDecision: ApprovalDecisionState | undefined;

  for (const event of input.initialEvents) {
    session = applyAgentEvent(session, event);

    if (event.type === "interaction.resolved") {
      approvalDecision = {
        status: event.status,
        title: event.title,
        summary: event.summary,
        ...(event.rejectionReason ? { rejectionReason: event.rejectionReason } : {}),
        ...(event.followUpStrategy ? { followUpStrategy: event.followUpStrategy } : {}),
      };
    }
  }

  return {
    messages: session.messages,
    plan: session.plan,
    actions: session.actions,
    pendingInteraction: session.pendingInteraction,
    runtime: session.runtime,
    ...(approvalDecision ? { approvalDecision } : {}),
  };
}

export function createWorkbenchViewModel(input: WebAppBootstrap): WorkbenchViewModel {
  const state = reduceWorkbenchEvents(input);
  const webEditor = createInteractiveWebEditorState(input.webEditor);
  const selectedBlock =
    webEditor.blocks.find((block) => block.id === webEditor.selectedBlockId) ?? webEditor.blocks[0];
  const selectedBlockFile = selectedBlock ? getWebEditorBlockFile(selectedBlock.id) : undefined;
  const patchActions = state.actions.filter(
    (action): action is PatchActionState => action.action.type === "file.patch",
  );
  const selectedDiffAction =
    patchActions.find((action) => action.id === input.selectedDiffActionId) ??
    patchActions[patchActions.length - 1];

  return {
    chatMessages: state.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    })),
    plan: state.plan,
    actions: state.actions,
    pendingInteraction: state.pendingInteraction,
    files: state.runtime.files,
    previews: state.runtime.openPorts,
    webEditor,
    ...(selectedBlock ? { selectedBlock } : {}),
    ...(selectedBlockFile ? { selectedBlockFile } : {}),
    patchActions,
    ...(selectedDiffAction ? { selectedDiffAction } : {}),
    ...(state.approvalDecision ? { approvalDecision: state.approvalDecision } : {}),
  };
}

export function createInteractiveWebEditorState(
  overrides: Partial<InteractiveWebEditorState> = {},
): InteractiveWebEditorState {
  const blocks =
    overrides.blocks ??
    [
      {
        id: "hero",
        label: "Hero Banner",
        selector: "main > header.topbar",
        html: "<header class='topbar'>...</header>",
        notes: "Primary workspace identity, title, and runtime context.",
      },
      {
        id: "conversation",
        label: "Conversation Stack",
        selector: "section.layout > section:nth-of-type(1)",
        html: "<section class='panel stack'>...</section>",
        notes: "Chat, plan, interaction, and action history.",
      },
      {
        id: "workbench",
        label: "Workbench Surface",
        selector: "section.layout > section:nth-of-type(2)",
        html: "<section class='panel stack'>...</section>",
        notes: "Files, editor, preview, terminal, and diff.",
      },
    ];
  const selectedBlockId = overrides.selectedBlockId ?? blocks[0]?.id;
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];

  return {
    ...(selectedBlockId ? { selectedBlockId } : {}),
    blocks,
    properties:
      overrides.properties ??
      [
        {
          key: "headline",
          label: "Headline",
          value: selectedBlock?.label ?? "Hero Banner",
        },
        {
          key: "tone",
          label: "Tone",
          value: "Operational",
        },
        {
          key: "visual_focus",
          label: "Visual Focus",
          value: "Execution visibility",
        },
      ],
    ...(overrides.lastIntent ? { lastIntent: overrides.lastIntent } : {}),
    ...(overrides.suggestedPrompt ? { suggestedPrompt: overrides.suggestedPrompt } : {}),
  };
}

export function createInteractiveWebEditResponse(
  request: InteractiveWebEditRequest,
  state: InteractiveWebEditorState = createInteractiveWebEditorState(),
): InteractiveWebEditResponse {
  const selectedBlock =
    state.blocks.find((block) => block.id === request.selection.blockId) ?? state.blocks[0];
  const nextState = createInteractiveWebEditorState({
    ...state,
    selectedBlockId: request.selection.blockId,
    properties: request.properties ?? state.properties,
    lastIntent: request.intent,
    suggestedPrompt: "",
  });
  const propertySummary = (request.properties ?? [])
    .map((property) => `${property.label}: ${property.value}`)
    .join(", ");

  return {
    nextState: {
      ...nextState,
      suggestedPrompt: [
        `Update page block ${request.selection.blockId} at ${request.selection.path}.`,
        `Strategy: ${request.patchStrategy}.`,
        `Intent: ${request.intent}.`,
        selectedBlock ? `Selector: ${selectedBlock.selector}.` : "",
        propertySummary ? `Properties: ${propertySummary}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    suggestedPrompt: [
      `Update page block ${request.selection.blockId} at ${request.selection.path}.`,
      `Strategy: ${request.patchStrategy}.`,
      `Intent: ${request.intent}.`,
      selectedBlock ? `Selector: ${selectedBlock.selector}.` : "",
      propertySummary ? `Properties: ${propertySummary}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function selectInteractiveWebEditorBlock(
  state: InteractiveWebEditorState,
  blockId: string,
): InteractiveWebEditorState {
  const block = state.blocks.find((item) => item.id === blockId) ?? state.blocks[0];

  return createInteractiveWebEditorState({
    ...state,
    selectedBlockId: blockId,
    properties: state.properties.map((property) =>
      property.key === "headline"
        ? {
            ...property,
            value: block?.label ?? property.value,
          }
        : property,
    ),
  });
}

export function upsertInteractiveWebEditorProperty(
  state: InteractiveWebEditorState,
  nextProperty: WebEditorProperty,
): InteractiveWebEditorState {
  const exists = state.properties.some((property) => property.key === nextProperty.key);

  return createInteractiveWebEditorState({
    ...state,
    properties: exists
      ? state.properties.map((property) =>
          property.key === nextProperty.key ? nextProperty : property,
        )
      : [...state.properties, nextProperty],
  });
}

export function getWebEditorBlockFile(blockId: string): string {
  if (blockId === "hero") {
    return "apps/web/src/index.ts";
  }

  if (blockId === "conversation") {
    return "apps/agent/src/index.ts";
  }

  if (blockId === "workbench") {
    return "apps/web/src/main.ts";
  }

  return "apps/web/src/index.ts";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPlanStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function summarizeAction(action: WorkbenchViewModel["actions"][number]["action"]): string {
  if (action.type === "file.write") {
    return `Write ${action.path}`;
  }

  if (action.type === "file.patch") {
    return `Patch ${action.path}`;
  }

  if (action.type === "command.run") {
    return `Run ${action.command}`;
  }

  if (action.type === "preview.open") {
    return `Open preview on port ${String(action.port ?? "unknown")}`;
  }

  if (action.type === "interaction.choice") {
    return action.question;
  }

  return action.title;
}

function summarizePatch(action: PatchActionState): string {
  const firstLine = action.action.patch.split("\n").find((line) => line.trim().length > 0);
  return firstLine ?? action.action.patch;
}

function renderPendingInteraction(interaction: PendingInteraction | undefined): string {
  if (!interaction) {
    return `<div class="empty-state">No pending interaction</div>`;
  }

  if (interaction.type === "choice") {
    return `
      <section class="card accent-card">
        <p class="eyebrow">Choice Required</p>
        <h3>${escapeHtml(interaction.question)}</h3>
        <ul class="option-list">
          ${interaction.options
            .map(
              (option) => `
                <li>
                  <strong>${escapeHtml(option.label)}</strong>
                  <p>${escapeHtml(option.description ?? "No description")}</p>
                </li>
              `,
            )
            .join("")}
        </ul>
      </section>
    `;
  }

  if (interaction.type === "confirm") {
    return `
      <section class="card accent-card">
        <p class="eyebrow">Confirmation</p>
        <h3>${escapeHtml(interaction.title)}</h3>
        <p>${escapeHtml(interaction.summary)}</p>
      </section>
    `;
  }

  return `
    <section class="card accent-card">
      <p class="eyebrow">Input Required</p>
      <h3>${escapeHtml(interaction.label)}</h3>
      <p>${escapeHtml(interaction.placeholder ?? "No placeholder provided")}</p>
    </section>
  `;
}

function renderWebEditor(state: InteractiveWebEditorState): string {
  const selectedBlock =
    state.blocks.find((block) => block.id === state.selectedBlockId) ?? state.blocks[0];
  const intentValue = escapeHtml(state.lastIntent ?? "");
  const selectedPath = escapeHtml(selectedBlock?.selector ?? "");

  return `
    <section class="card accent-card">
      <p class="eyebrow">Interactive Web Editor</p>
      <h3>${escapeHtml(selectedBlock?.label ?? "No block selected")}</h3>
      <p>${escapeHtml(selectedBlock?.notes ?? "Select a page block and refine it with intent plus structured properties.")}</p>
      <div class="subgrid">
        <div class="card">
          <p class="eyebrow">Blocks</p>
          <ul class="message-list">
            ${state.blocks
              .map(
                (block) => `
                  <li class="${block.id === state.selectedBlockId ? "selected-item" : ""}">
                    <button class="editor-block-button" data-block-id="${escapeHtml(block.id)}" type="button">
                      <strong>${escapeHtml(block.label)}</strong>
                      <span>${escapeHtml(block.selector)}</span>
                    </button>
                  </li>
                `,
              )
              .join("")}
          </ul>
        </div>
        <div class="card">
          <p class="eyebrow">Properties</p>
          <ul class="message-list">
            ${state.properties
              .map(
                (property) => `
                  <li>
                    <strong>${escapeHtml(property.label)}</strong>
                    <p>${escapeHtml(property.value)}</p>
                  </li>
                `,
              )
              .join("")}
          </ul>
        </div>
      </div>
      <form class="card editor-form" data-editor-form="interactive-web-editor">
        <p class="eyebrow">Patch Request</p>
        <label class="field">
          <span>Selected Path</span>
          <input name="path" value="${selectedPath}" readonly />
        </label>
        <label class="field">
          <span>Intent</span>
          <textarea name="intent" rows="3" placeholder="Describe the change">${intentValue}</textarea>
        </label>
        <div class="subgrid">
          ${state.properties
            .map(
              (property) => `
                <label class="field">
                  <span>${escapeHtml(property.label)}</span>
                  <input name="property:${escapeHtml(property.key)}" value="${escapeHtml(property.value)}" />
                </label>
              `,
            )
            .join("")}
        </div>
        <label class="field">
          <span>Patch Strategy</span>
          <select name="patchStrategy">
            <option value="refine" selected>refine</option>
            <option value="append">append</option>
            <option value="replace">replace</option>
          </select>
        </label>
        <button class="submit-button" type="submit">Generate Patch Prompt</button>
      </form>
      <div class="card">
        <p class="eyebrow">Intent</p>
        <p>${escapeHtml(state.lastIntent ?? "No edit request captured yet.")}</p>
      </div>
      <div class="card">
        <p class="eyebrow">Suggested Prompt</p>
        <p>${escapeHtml(state.suggestedPrompt ?? "Submit an edit request to generate a block-scoped prompt.")}</p>
      </div>
    </section>
  `;
}

function renderPreviewSelection(state: InteractiveWebEditorState, previewUrl?: string): string {
  const selectedBlock =
    state.blocks.find((block) => block.id === state.selectedBlockId) ?? state.blocks[0];

  return `
    <div class="card preview-surface">
      <p class="eyebrow">Preview Surface</p>
      <div class="preview-stack">
        ${state.blocks
          .map(
            (block) => `
              <button
                type="button"
                class="preview-block ${block.id === state.selectedBlockId ? "preview-block-active" : ""}"
                data-preview-block-id="${escapeHtml(block.id)}"
              >
                <span class="preview-block-label">${escapeHtml(block.label)}</span>
                <span class="preview-block-path">${escapeHtml(block.selector)}</span>
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="card preview-detail">
        <p class="eyebrow">Selected Block</p>
        <h3>${escapeHtml(selectedBlock?.label ?? "No block selected")}</h3>
        <p>${escapeHtml(selectedBlock?.html ?? "No HTML snapshot")}</p>
      </div>
      ${
        previewUrl
          ? `
            <div class="card preview-detail">
              <p class="eyebrow">Live Preview</p>
              <iframe
                class="preview-frame"
                src="${escapeHtml(previewUrl)}"
                title="Live browser runtime preview"
                loading="lazy"
              ></iframe>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderDiffPanel(workbench: WorkbenchViewModel): string {
  if (!workbench.selectedDiffAction) {
    return `<div class="empty-state">No patch action available yet</div>`;
  }

  const approvalActions =
    workbench.pendingInteraction?.type === "confirm"
      ? `
        <label class="approval-reason-field">
          <span>Reject Reason</span>
          <textarea
            class="approval-reason-input"
            data-reject-reason
            rows="3"
            placeholder="Explain what is wrong with this patch and what should change in the replacement."
          ></textarea>
        </label>
        <div class="approval-actions">
          <button type="button" class="approval-button approve-button" data-approval-decision="approved">
            Approve Patch
          </button>
          <button type="button" class="approval-button reject-button" data-approval-decision="rejected">
            Reject Patch
          </button>
        </div>
      `
      : "";

  const approvalCard =
    workbench.approvalDecision
      ? `
        <div class="card ${workbench.approvalDecision.status === "approved" ? "approval-success-card" : "approval-reject-card"}">
          <p class="eyebrow">${escapeHtml(workbench.approvalDecision.status)}</p>
          <h3>${escapeHtml(workbench.approvalDecision.title)}</h3>
          <p>${escapeHtml(workbench.approvalDecision.summary)}</p>
          ${
            workbench.approvalDecision.rejectionReason
              ? `<p><strong>Reject reason:</strong> ${escapeHtml(workbench.approvalDecision.rejectionReason)}</p>`
              : ""
          }
          ${
            workbench.approvalDecision.followUpStrategy
              ? `<p>Follow-up: ${escapeHtml(workbench.approvalDecision.followUpStrategy)}</p>`
              : ""
          }
        </div>
      `
      : workbench.pendingInteraction?.type === "confirm"
      ? `
        <div class="card approval-card">
          <p class="eyebrow">Approval Required</p>
          <h3>${escapeHtml(workbench.pendingInteraction.title)}</h3>
          <p>${escapeHtml(workbench.pendingInteraction.summary)}</p>
          ${approvalActions}
        </div>
      `
      : "";

  return `
    <div class="stack">
      ${approvalCard}
      <div class="card diff-header">
        <p class="eyebrow">Current Patch</p>
        <h3>${escapeHtml(workbench.selectedDiffAction.action.path)}</h3>
        <p>${escapeHtml(summarizePatch(workbench.selectedDiffAction))}</p>
      </div>
      <div class="card">
        <p class="eyebrow">Patch Actions</p>
        <ul class="message-list">
          ${workbench.patchActions
            .map(
              (action) => `
                <li class="${action.id === workbench.selectedDiffAction?.id ? "selected-item" : ""}">
                  <button
                    type="button"
                    class="timeline-action-button"
                    data-diff-action-id="${escapeHtml(action.id)}"
                    data-file-path="${escapeHtml(action.action.path)}"
                  >
                    <strong>${escapeHtml(action.action.path)}</strong>
                    <span>${escapeHtml(action.status)}</span>
                  </button>
                </li>
              `,
            )
            .join("")}
        </ul>
      </div>
      <div class="card code-block">
        <p class="eyebrow">Patch Content</p>
        <pre>${escapeHtml(workbench.selectedDiffAction.action.patch)}</pre>
      </div>
    </div>
  `;
}

function renderEditorCode(workbench: WorkbenchViewModel): string {
  const content =
    workbench.selectedDiffAction?.action.patch ??
    workbench.selectedBlock?.html ??
    workbench.webEditor.suggestedPrompt ??
    "No editor content available yet.";
  const lines = content.split("\n");

  return `
    <div class="code-view">
      <ol class="line-numbers">
        ${lines.map((_, index) => `<li>${String(index + 1)}</li>`).join("")}
      </ol>
      <ol class="code-lines">
        ${lines.map((line) => `<li class="code-line">${escapeHtml(line || " ")}</li>`).join("")}
      </ol>
    </div>
  `;
}

function renderSessionTerminal(workbench: WorkbenchViewModel): string {
  const preview = workbench.previews[workbench.previews.length - 1];
  const fileAction = [...workbench.actions]
    .reverse()
    .find((action) => action.action.type === "file.write" || action.action.type === "file.patch");
  const lines = [
    "Network: browser runtime ready",
    "watching session state and runtime events",
    fileAction ? `$ sync ${summarizeAction(fileAction.action)}` : "$ waiting for file activity",
    preview ? `preview ready: ${preview.url}` : "preview pending",
    "",
    `session:${workbench.chatMessages.length}-messages plan:${workbench.plan.length}-steps`,
    "~/project $",
  ];

  return lines
    .map((line, index) => {
      if (index === 0) {
        return `<p><span class="terminal-dot"></span> ${escapeHtml(line)}</p>`;
      }

      if (line.startsWith("$") || line.startsWith("~/")) {
        return `<p><span class="terminal-accent">${escapeHtml(line)}</span></p>`;
      }

      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function renderSessionPreview(workbench: WorkbenchViewModel): string {
  const activePreview = workbench.previews[workbench.previews.length - 1];

  if (!activePreview) {
    return `<div class="empty-state dark-empty">No live preview yet</div>`;
  }

  return `
    <div class="browser-frame">
      <div class="browser-toolbar">
        <div class="browser-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="browser-url">${escapeHtml(activePreview.url)}</div>
      </div>
      <iframe
        class="preview-frame"
        src="${escapeHtml(activePreview.url)}"
        title="Live browser runtime preview"
        loading="lazy"
      ></iframe>
    </div>
  `;
}

function renderChatMessages(workbench: WorkbenchViewModel): string {
  if (workbench.chatMessages.length === 0) {
    return `<div class="empty-state dark-empty">No messages yet.</div>`;
  }

  return `
    <div class="chat-stream">
      ${workbench.chatMessages
        .map((message, index) => {
          const role = message.role ?? "assistant";
          const roleLabel =
            role === "assistant" ? "Bolt" : role === "user" ? "You" : "System";
          const content = escapeHtml(message.content).replaceAll("\n", "<br />");
          const rowClass = role === "user" ? "chat-row chat-row-user" : "chat-row";
          const bubbleClass =
            role === "user"
              ? "chat-bubble chat-bubble-user"
              : role === "system"
                ? "chat-bubble chat-bubble-system"
                : "chat-bubble";

          return `
            <div class="${rowClass}">
              <div class="chat-meta">
                <span class="chat-role">${escapeHtml(roleLabel)}</span>
                <span class="chat-id">#${index + 1}</span>
              </div>
              <div class="${bubbleClass}">
                <p>${content}</p>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

export const webAppStyles = `
  :root {
    color-scheme: dark;
    --bg: #0c0f14;
    --bg-top: #0b0d12;
    --panel: #12161d;
    --panel-2: #171c24;
    --panel-3: #0f1319;
    --surface: #1b212b;
    --surface-2: #202735;
    --line: rgba(255, 255, 255, 0.08);
    --line-strong: rgba(255, 255, 255, 0.14);
    --text: #eef2ff;
    --muted: #9aa4b2;
    --dim: #7f8997;
    --accent: #4f8cff;
    --accent-soft: rgba(79, 140, 255, 0.16);
    --success: #4ade80;
    --danger: #f87171;
    --shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    min-height: 100%;
    background:
      radial-gradient(circle at top left, rgba(79, 140, 255, 0.12), transparent 24%),
      radial-gradient(circle at top right, rgba(45, 212, 191, 0.08), transparent 20%),
      linear-gradient(180deg, #0a0c11 0%, #0c0f14 100%);
    color: var(--text);
    font-family: Inter, "Segoe UI", sans-serif;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  .app-shell {
    min-height: 100vh;
    padding: 14px;
  }

  .workspace-shell {
    min-height: calc(100vh - 28px);
    display: grid;
    grid-template-rows: auto 1fr;
    border: 1px solid var(--line);
    border-radius: 18px;
    overflow: hidden;
    background: rgba(10, 12, 17, 0.9);
    box-shadow: var(--shadow);
  }

  .workspace-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    background: rgba(18, 21, 28, 0.96);
  }

  .workspace-topbar,
  .topbar-left,
  .topbar-right,
  .topbar-actions,
  .topbar-crumbs {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-mark,
  .toolbar-chip,
  .avatar {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
  }

  .toolbar-chip {
    cursor: pointer;
    font: inherit;
    padding: 0;
  }

  .toolbar-chip-active {
    background: var(--accent-soft);
    border-color: rgba(79, 140, 255, 0.5);
    color: #dbe7ff;
  }

  .brand-mark {
    font-style: italic;
    font-weight: 800;
  }

  .topbar-title {
    color: var(--text);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .crumb-muted,
  .workspace-topbar p,
  .meta,
  li {
    color: var(--muted);
  }

  .topbar-button {
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    padding: 8px 12px;
    cursor: pointer;
  }

  .topbar-button-primary {
    background: #f6f7fb;
    color: #111827;
    font-weight: 600;
  }

  .workspace-content {
    display: grid;
    grid-template-columns: 320px 250px minmax(0, 1fr);
    min-height: 0;
  }

  .workspace-shell[data-view-mode="preview"] .file-rail,
  .workspace-shell[data-view-mode="preview"] .editor-pane,
  .workspace-shell[data-view-mode="preview"] .diff-pane,
  .workspace-shell[data-view-mode="preview"] .terminal {
    display: none;
  }

  .workspace-shell[data-view-mode="preview"] .editor-split {
    grid-template-columns: 1fr;
  }

  .workspace-shell[data-view-mode="code"] .preview-pane,
  .workspace-shell[data-view-mode="code"] .diff-pane,
  .workspace-shell[data-view-mode="code"] .terminal {
    display: none;
  }

  .workspace-shell[data-view-mode="code"] .editor-split {
    grid-template-columns: 1fr;
  }

  .eyebrow {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #7ab8ff;
    font-weight: 600;
  }

  .workspace-rail,
  .file-rail {
    display: grid;
    grid-template-rows: 1fr;
    border-right: 1px solid var(--line);
    background: rgba(16, 19, 25, 0.94);
    min-height: 0;
  }

  .workspace-rail {
    padding: 18px 16px 16px;
  }

  .rail-scroll,
  .file-tree,
  .code-scroll,
  .terminal-body {
    overflow: auto;
  }

  .rail-scroll {
    padding-right: 4px;
  }

  .rail-accordion {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel);
    margin-bottom: 14px;
    overflow: hidden;
  }

  .rail-accordion summary {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    cursor: pointer;
    list-style: none;
  }

  .rail-accordion summary::-webkit-details-marker {
    display: none;
  }

  .rail-accordion summary strong {
    display: block;
    color: var(--text);
    font-size: 0.95rem;
  }

  .rail-accordion[open] summary {
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--line);
  }

  .accordion-body {
    display: grid;
    gap: 12px;
    padding: 12px 14px 14px;
  }

  .rail-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rail-summary {
    margin: 0;
    color: var(--dim);
    font-size: 0.85rem;
  }

  .rail-scroll h1,
  .panel-title,
  .card h3,
  .preview-pane h2,
  .diff-pane h2 {
    margin: 0;
    font-family: "Space Grotesk", "Segoe UI", sans-serif;
    letter-spacing: -0.04em;
  }

  .rail-scroll h1 {
    font-size: 1.04rem;
    line-height: 1.75;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .rail-scroll p,
  .rail-scroll li,
  .card p {
    line-height: 1.7;
    font-size: 0.93rem;
  }

  .chat-stream {
    display: grid;
    gap: 12px;
  }

  .chat-row {
    display: grid;
    gap: 6px;
  }

  .chat-row-user {
    justify-items: end;
    text-align: right;
  }

  .chat-meta {
    display: flex;
    gap: 8px;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--dim);
  }

  .chat-row-user .chat-meta {
    justify-content: flex-end;
  }

  .chat-role {
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
  }

  .chat-id {
    color: var(--muted);
  }

  .chat-bubble {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--text);
  }

  .chat-bubble p {
    margin: 0;
  }

  .chat-bubble-user {
    background: rgba(79, 140, 255, 0.18);
    border-color: rgba(79, 140, 255, 0.32);
  }

  .chat-bubble-system {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .rail-scroll ul,
  .message-list,
  .option-list {
    margin: 10px 0 18px;
    padding-left: 18px;
  }

  .message-list,
  .option-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .message-list li,
  .option-list li {
    margin: 0;
  }

  .message-role {
    margin-bottom: 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #7ab8ff;
  }

  .task-card,
  .prompt-box,
  .card,
  .empty-state {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel);
  }

  .dark-empty {
    background: #0f1319;
    color: var(--dim);
  }

  .task-card,
  .prompt-box,
  .card {
    padding: 14px;
  }

  .task-card {
    margin-top: 18px;
    background: linear-gradient(180deg, #1d2330 0%, #151920 100%);
  }

  .task-card .label {
    display: block;
    color: var(--text);
    font-weight: 600;
  }

  .task-card .meta {
    display: block;
    margin-top: 6px;
    font-size: 0.82rem;
    color: var(--dim);
  }

  .prompt-box {
    margin-top: 16px;
    background: #12161d;
  }

  .rail-grid {
    display: grid;
    gap: 12px;
  }

  .rail-meta-grid {
    display: grid;
    gap: 10px;
  }

  .rail-meta-grid strong {
    display: block;
    color: var(--text);
    margin-top: 4px;
  }

  .plan-list {
    list-style: none;
    padding: 0;
    margin: 10px 0 0;
    display: grid;
    gap: 10px;
  }

  .plan-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.03);
    font-size: 0.85rem;
  }

  .plan-title {
    color: var(--text);
  }

  .plan-status {
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
  }

  .prompt-input {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--dim);
  }

  .prompt-input input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text);
    outline: none;
  }

  .send-button,
  .submit-button,
  .approval-button,
  .session-button {
    border: none;
    border-radius: 999px;
    cursor: pointer;
  }

  .send-button {
    margin-left: auto;
    width: 28px;
    height: 28px;
    background: var(--accent);
    color: white;
  }

  .prompt-footer,
  .pill-row {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
    color: var(--muted);
    font-size: 13px;
  }

  .file-rail {
    grid-template-rows: auto 1fr;
  }

  .file-topbar,
  .editor-topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
    background: rgba(18, 21, 28, 0.96);
    color: var(--muted);
    font-size: 0.9rem;
  }

  .file-topbar strong,
  .editor-topbar strong {
    color: var(--text);
  }

  .file-tree {
    padding: 12px 10px 16px;
  }

  .file-item,
  .editor-block-button,
  .timeline-action-button,
  .preview-block,
  .session-button {
    width: 100%;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    padding: 9px 10px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 0.92rem;
  }

  .file-item-active,
  .selected-item,
  .preview-block-active {
    background: var(--accent-soft);
    border-color: rgba(79, 140, 255, 0.28);
    color: #dce8ff;
  }

  .editor-shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
    background: var(--panel-3);
  }

  .editor-split {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
    min-height: 0;
  }

  .editor-pane {
    border-right: 1px solid var(--line);
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
  }

  .preview-pane {
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: #11161d;
  }

  .preview-pane-header,
  .diff-pane-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
    background: rgba(18, 21, 28, 0.96);
  }

  .preview-pane-header p,
  .diff-pane-header p {
    margin: 0 0 6px;
  }

  .preview-pane-header h2,
  .diff-pane-header h2 {
    font-size: 1rem;
  }

  .code-view {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    min-height: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.9rem;
    line-height: 1.8;
  }

  .line-numbers,
  .code-lines {
    margin: 0;
    padding: 16px 0;
    list-style: none;
  }

  .line-numbers {
    text-align: right;
    padding-right: 14px;
    color: #5f6b7b;
    border-right: 1px solid var(--line);
    background: #11141b;
  }

  .code-lines {
    padding-left: 18px;
    padding-right: 18px;
    color: #d7deea;
  }

  .code-line {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .browser-frame {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    padding: 14px;
    gap: 12px;
  }

  .browser-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .browser-dots {
    display: flex;
    gap: 8px;
  }

  .browser-dots span {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #5f6b7b;
  }

  .browser-url {
    flex: 1;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 8px 12px;
    color: var(--muted);
    background: #161c25;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-frame {
    width: 100%;
    height: 100%;
    min-height: 320px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: white;
  }

  .preview-controls {
    display: grid;
    gap: 10px;
    padding: 0 14px 14px;
  }

  .preview-stack {
    display: grid;
    gap: 8px;
  }

  .preview-block {
    display: grid;
    gap: 4px;
    border-color: var(--line);
    background: #161c25;
  }

  .preview-block-label {
    color: var(--text);
    font-weight: 600;
  }

  .preview-block-path {
    color: var(--dim);
    font-size: 0.82rem;
  }

  .diff-pane {
    border-top: 1px solid var(--line);
    background: #12161d;
    min-height: 0;
  }

  .diff-pane-body {
    padding: 14px;
    max-height: 260px;
    overflow: auto;
  }

  .empty-state {
    padding: 16px;
    color: var(--muted);
    background: rgba(255, 255, 255, 0.03);
  }

  .dark-empty {
    background: #151920;
  }

  .field {
    display: grid;
    gap: 6px;
    color: var(--text);
  }

  .field input,
  .field textarea,
  .field select,
  .approval-reason-input {
    width: 100%;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 10px 12px;
    background: #11161d;
    color: var(--text);
  }

  .editor-form,
  .subgrid,
  .section-card,
  .stack {
    display: grid;
    gap: 12px;
  }

  .subgrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .submit-button {
    justify-self: start;
    padding: 11px 16px;
    background: var(--accent);
    color: white;
  }

  .approval-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .approve-button {
    padding: 10px 14px;
    background: #14532d;
    color: white;
  }

  .reject-button {
    padding: 10px 14px;
    background: #7f1d1d;
    color: white;
  }

  .approval-card,
  .approval-success-card,
  .approval-reject-card,
  .accent-card,
  .preview-detail,
  .diff-header {
    background: #151a23;
  }

  .terminal {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 188px;
    border-top: 1px solid var(--line);
    background: #11141b;
  }

  .terminal-tabs {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.88rem;
  }

  .terminal-tab {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.02);
  }

  .terminal-tab.active {
    color: var(--text);
    background: rgba(255, 255, 255, 0.06);
  }

  .terminal-body {
    padding: 14px 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.86rem;
    line-height: 1.65;
    color: #b9c4d0;
  }

  .terminal-body p {
    margin: 0;
  }

  .terminal-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 999px;
    background: var(--success);
  }

  .terminal-accent {
    color: #7ab8ff;
  }

  @media (max-width: 1120px) {
    .workspace-content,
    .editor-split {
      grid-template-columns: 1fr;
    }

    .subgrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .app-shell {
      padding: 0;
    }

    .workspace-shell {
      min-height: 100vh;
      border-radius: 0;
    }

    .workspace-topbar {
      flex-wrap: wrap;
    }
  }
`;

export function renderWebAppBody(input: WebAppBootstrap): string {
  const shell = createWebAppShell(input);
  const { workbench } = shell;
  const uniqueFiles = [
    ...new Set([
      "src",
      ...(workbench.files.length > 0 ? workbench.files : ["src/App.tsx", "src/index.css", "main.tsx"]),
      ...(workbench.selectedBlockFile ? [workbench.selectedBlockFile] : []),
    ]),
  ];
  const activeFile =
    input.activeFile ??
    workbench.selectedDiffAction?.action.path ??
    workbench.selectedBlockFile ??
    uniqueFiles[0] ??
    "src/App.tsx";
  const currentMessage = workbench.chatMessages[workbench.chatMessages.length - 1];
  const viewMode: ViewMode = input.viewMode ?? "layout";

  return `
    <main class="app-shell">
      <div class="workspace-shell" data-view-mode="${escapeHtml(viewMode)}">
        <header class="workspace-topbar">
          <div class="topbar-left">
            <div class="brand-mark">b</div>
            <div class="avatar">B</div>
            <div class="topbar-crumbs">
              <span class="topbar-title">${escapeHtml(shell.topBar.projectName)}</span>
              <span class="crumb-muted">🔒</span>
            </div>
          </div>
          <div class="topbar-right">
            <div class="topbar-actions">
              <button
                class="toolbar-chip ${viewMode === "preview" ? "toolbar-chip-active" : ""}"
                data-toolbar-action="preview"
                type="button"
                aria-label="Preview view"
              >👁</button>
              <button
                class="toolbar-chip ${viewMode === "code" ? "toolbar-chip-active" : ""}"
                data-toolbar-action="code"
                type="button"
                aria-label="Code view"
              >&lt;/&gt;</button>
              <button
                class="toolbar-chip ${viewMode === "layout" ? "toolbar-chip-active" : ""}"
                data-toolbar-action="layout"
                type="button"
                aria-label="Layout view"
              >▤</button>
            </div>
            <button class="topbar-button" data-open-dialog="sessions" type="button">Sessions</button>
            <button class="topbar-button" data-open-dialog="share" type="button">Share</button>
            <button class="topbar-button topbar-button-primary" data-open-dialog="publish" type="button">Publish</button>
            <div class="avatar">B</div>
          </div>
        </header>

        <section class="workspace-content">
          <aside class="workspace-rail">
            <div class="rail-scroll">
              <details class="rail-accordion" open>
                <summary>
                  <div>
                    <p class="eyebrow">Conversation</p>
                    <h1>${escapeHtml(currentMessage?.content ?? "Start with a request and keep context together in one workspace.")}</h1>
                  </div>
                  <div class="rail-badges">
                    <span class="pill">${escapeHtml(String(workbench.chatMessages.length))} messages</span>
                    <span class="pill">${escapeHtml(String(workbench.plan.length))} steps</span>
                  </div>
                </summary>
                <div class="accordion-body">
                  <p class="rail-summary">Runtime: ${escapeHtml(shell.topBar.runtimeType)} · Active block ${escapeHtml(workbench.selectedBlock?.label ?? "None")}</p>
                  ${renderChatMessages(workbench)}
                </div>
              </details>

              <details class="rail-accordion" open>
                <summary>
                  <p class="eyebrow">Composer</p>
                  <strong>Send a new request</strong>
                </summary>
                <div class="accordion-body">
                  <div class="prompt-box">
                    <div class="meta">How can Bolt help you today? (or /command)</div>
                    <div class="prompt-input">
                      <span>+</span>
                      <input
                        data-command-input
                        value="${escapeHtml(input.composerText ?? "")}"
                        placeholder="Ask Bolt to refine layout, preview, or patch flow"
                      />
                      <span>${escapeHtml(shell.topBar.runtimeType)}</span>
                      <button class="send-button" data-send-message type="button" aria-label="Send">↑</button>
                    </div>
                    <div class="prompt-footer">
                      <span>${escapeHtml(String(workbench.actions.length))} actions</span>
                      <span>${escapeHtml(String(workbench.previews.length))} previews</span>
                    </div>
                  </div>
                </div>
              </details>

              <details class="rail-accordion">
                <summary>
                  <p class="eyebrow">Session & Plan</p>
                  <strong>Context and execution</strong>
                </summary>
                <div class="accordion-body">
                  <div class="rail-grid">
                    <div class="card section-card">
                      <p class="eyebrow">Session</p>
                      <div class="rail-meta-grid">
                        <div>
                          <span class="meta">Project</span>
                          <strong>${escapeHtml(shell.topBar.projectName)}</strong>
                        </div>
                        <div>
                          <span class="meta">Session</span>
                          <strong>${escapeHtml(input.sessionId)}</strong>
                        </div>
                        <div>
                          <span class="meta">Patch Actions</span>
                          <strong>${escapeHtml(String(workbench.patchActions.length))}</strong>
                        </div>
                        <div>
                          <span class="meta">Preview Ports</span>
                          <strong>${escapeHtml(String(workbench.previews.length))}</strong>
                        </div>
                      </div>
                    </div>
                    <div class="card section-card">
                      <p class="eyebrow">Plan</p>
                      <ul class="plan-list">
                        ${workbench.plan.length > 0
                          ? workbench.plan
                              .map(
                                (step) => `
                                  <li>
                                    <span class="plan-title">${escapeHtml(step.title)}</span>
                                    <span class="plan-status">${escapeHtml(renderPlanStatus(step.status))}</span>
                                  </li>
                                `,
                              )
                              .join("")
                          : `<li class="empty-state dark-empty">No plan yet</li>`}
                      </ul>
                    </div>
                  </div>
                </div>
              </details>

              <details class="rail-accordion">
                <summary>
                  <p class="eyebrow">Pending</p>
                  <strong>Approvals & input</strong>
                </summary>
                <div class="accordion-body">
                  ${renderPendingInteraction(workbench.pendingInteraction)}
                </div>
              </details>

              <details class="rail-accordion">
                <summary>
                  <p class="eyebrow">Editor</p>
                  <strong>Interactive Web Editor</strong>
                </summary>
                <div class="accordion-body">
                  ${renderWebEditor(workbench.webEditor)}
                </div>
              </details>
            </div>
          </aside>

          <aside class="file-rail">
            <div class="file-topbar">
              <strong>Files</strong>
              <span>Search</span>
            </div>
            <div class="file-tree">
              ${uniqueFiles
                .map(
                  (file) => `
                    <button
                      class="file-item ${file === activeFile ? "file-item-active" : ""}"
                      data-file-path="${escapeHtml(file)}"
                      type="button"
                    >
                      <span>${escapeHtml(file === "src" ? "⌄" : "▸")}</span>
                      <span>${escapeHtml(file)}</span>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </aside>

          <section class="editor-shell">
            <div class="editor-topbar">
              <span>${escapeHtml(activeFile.replace(/\//g, " > "))}</span>
              <strong>${escapeHtml(workbench.selectedBlock?.label ?? "Workspace Block")}</strong>
            </div>

            <div class="editor-split">
              <div class="editor-pane">
                ${renderEditorCode(workbench)}
              </div>

              <div class="preview-pane">
                <div class="preview-pane-header">
                  <p class="eyebrow">Preview</p>
                  <h2>Embedded browser runtime</h2>
                </div>
                ${renderSessionPreview(workbench)}
                <div class="preview-controls">
                  <div class="preview-stack">
                    ${workbench.webEditor.blocks
                      .map(
                        (block) => `
                          <button
                            type="button"
                            class="preview-block ${block.id === workbench.webEditor.selectedBlockId ? "preview-block-active" : ""}"
                            data-preview-block-id="${escapeHtml(block.id)}"
                          >
                            <span class="preview-block-label">${escapeHtml(block.label)}</span>
                            <span class="preview-block-path">${escapeHtml(block.selector)}</span>
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                </div>
              </div>
            </div>

            <div class="diff-pane">
              <div class="diff-pane-header">
                <p class="eyebrow">Review</p>
                <h2>Patch review and runtime output</h2>
              </div>
              <div class="diff-pane-body">
                <div class="stack">
                  ${renderDiffPanel(workbench)}
                </div>
              </div>
            </div>

            <div class="terminal">
              <div class="terminal-tabs">
                <span class="terminal-tab active">Bolt</span>
                <span class="terminal-tab">Publish Output</span>
                <span class="terminal-tab">Terminal</span>
                <span>+</span>
              </div>
              <div class="terminal-body">${renderSessionTerminal(workbench)}</div>
            </div>
          </section>
        </section>
      </div>
    </main>
  `;
}

export function renderWebAppDocument(input: WebAppBootstrap): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.config.projectName)} Workspace</title>
    <style>${webAppStyles}</style>
  </head>
  <body>${renderWebAppBody(input)}</body>
</html>`;
}

export function createWebAppShell(input: WebAppBootstrap) {
  return {
    topBar: {
      projectName: input.config.projectName,
      runtimeType: input.config.runtimeType,
    },
    centerPanels: centerWorkspacePanels,
    rightPanels: rightWorkbenchPanels,
    initialEvents: input.initialEvents,
    workbench: createWorkbenchViewModel(input),
  };
}
