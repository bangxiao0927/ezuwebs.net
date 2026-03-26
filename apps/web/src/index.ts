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
}

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

function renderPreviewSelection(state: InteractiveWebEditorState): string {
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

export const webAppStyles = `
  :root {
    color-scheme: light;
    --bg: #f4efe7;
    --bg-strong: #ebe2d4;
    --panel: rgba(255, 251, 245, 0.86);
    --panel-strong: #fffdf8;
    --panel-tint: #f6ecdd;
    --ink: #201a14;
    --muted: #65594d;
    --line: rgba(100, 78, 53, 0.16);
    --line-strong: rgba(100, 78, 53, 0.28);
    --accent: #b85c2f;
    --accent-strong: #8f431d;
    --accent-soft: rgba(184, 92, 47, 0.12);
    --success: #2f6a49;
    --danger: #9b3c2d;
    --shadow: 0 24px 60px rgba(49, 31, 12, 0.08);
  }

  * {
    box-sizing: border-box;
  }

  html {
    background: var(--bg);
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at top left, rgba(184, 92, 47, 0.18), transparent 24%),
      radial-gradient(circle at right top, rgba(64, 108, 97, 0.12), transparent 28%),
      linear-gradient(180deg, #f8f1e7 0%, var(--bg) 34%, var(--bg-strong) 100%);
    color: var(--ink);
  }

  .app-shell {
    min-height: 100vh;
    padding: 32px 24px 40px;
  }

  .shell-frame {
    width: min(1480px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 20px;
  }

  .topbar {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.95fr);
    gap: 18px;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 28px;
    background:
      linear-gradient(145deg, rgba(255, 252, 247, 0.92), rgba(244, 236, 224, 0.88)),
      rgba(255, 255, 255, 0.72);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
  }

  .topbar h1,
  .panel h2,
  .card h3 {
    margin: 0;
    font-family: "Space Grotesk", "Avenir Next Condensed", sans-serif;
    letter-spacing: -0.03em;
  }

  .topbar p,
  .card p,
  .meta,
  li,
  .pill {
    margin: 0;
    color: var(--muted);
  }

  .topbar-copy {
    display: grid;
    gap: 14px;
  }

  .topbar-copy h1 {
    font-size: clamp(34px, 4vw, 52px);
    line-height: 0.94;
    max-width: 12ch;
  }

  .topbar-summary {
    max-width: 62ch;
    line-height: 1.6;
    font-size: 15px;
  }

  .hero-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .hero-stat {
    min-width: 150px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(100, 78, 53, 0.12);
    background: rgba(255, 255, 255, 0.58);
  }

  .hero-stat strong {
    display: block;
    color: var(--ink);
    font-size: 20px;
    line-height: 1.1;
    margin-top: 4px;
  }

  .topbar-side {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .topbar-status {
    display: grid;
    gap: 10px;
    padding: 18px;
    border-radius: 22px;
    border: 1px solid rgba(184, 92, 47, 0.16);
    background: linear-gradient(180deg, rgba(184, 92, 47, 0.12), rgba(255, 253, 248, 0.96));
  }

  .topbar-status strong {
    color: var(--ink);
    font-size: 16px;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(240px, 0.72fr) minmax(440px, 1.24fr) minmax(360px, 1fr);
    gap: 20px;
  }

  .panel {
    border: 1px solid var(--line);
    border-radius: 26px;
    background: var(--panel);
    padding: 20px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(16px);
  }

  .stack {
    display: grid;
    gap: 16px;
  }

  .panel-head {
    display: grid;
    gap: 6px;
  }

  .panel-head p,
  .panel-head h2 {
    margin: 0;
  }

  .card {
    padding: 16px;
    border-radius: 20px;
    background: var(--panel-strong);
    border: 1px solid rgba(100, 78, 53, 0.12);
  }

  .accent-card {
    background: linear-gradient(180deg, rgba(184, 92, 47, 0.1), rgba(255, 253, 248, 0.96));
  }

  .eyebrow {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
    font-weight: 600;
  }

  .pill-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pill {
    display: inline-flex;
    padding: 6px 10px;
    border: 1px solid rgba(100, 78, 53, 0.14);
    border-radius: 999px;
    background: rgba(246, 236, 221, 0.72);
    font-size: 13px;
  }

  .status {
    color: var(--success);
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }

  .message-list,
  .option-list {
    display: grid;
    gap: 12px;
    padding: 0;
    list-style: none;
  }

  .message-role {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    margin-bottom: 6px;
  }

  .empty-state {
    padding: 16px;
    border-radius: 18px;
    border: 1px dashed var(--line-strong);
    color: var(--muted);
    background: rgba(255, 251, 245, 0.58);
  }

  .selected-item {
    padding: 10px;
    border-radius: 16px;
    background: rgba(184, 92, 47, 0.08);
    border: 1px solid rgba(184, 92, 47, 0.18);
  }

  .editor-block-button {
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    text-align: left;
    color: inherit;
    display: grid;
    gap: 4px;
    cursor: pointer;
    font: inherit;
  }

  button,
  input,
  textarea,
  select {
    transition:
      border-color 160ms ease,
      background-color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease;
  }

  .editor-form {
    display: grid;
    gap: 12px;
  }

  .field {
    display: grid;
    gap: 6px;
    color: var(--ink);
  }

  .field input,
  .field textarea,
  .field select {
    width: 100%;
    border: 1px solid rgba(100, 78, 53, 0.18);
    border-radius: 14px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.82);
    font: inherit;
    color: var(--ink);
  }

  .field input:focus,
  .field textarea:focus,
  .field select:focus,
  .editor-block-button:focus-visible,
  .timeline-action-button:focus-visible,
  .preview-block:focus-visible,
  .approval-button:focus-visible,
  .submit-button:focus-visible {
    outline: none;
    border-color: rgba(184, 92, 47, 0.44);
    box-shadow: 0 0 0 4px rgba(184, 92, 47, 0.12);
  }

  .submit-button {
    border: 0;
    border-radius: 999px;
    padding: 12px 16px;
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #fffdf8;
    font: inherit;
    cursor: pointer;
    font-weight: 600;
    justify-self: start;
  }

  .submit-button:hover,
  .approval-button:hover,
  .preview-block:hover {
    transform: translateY(-1px);
  }

  .preview-surface {
    display: grid;
    gap: 12px;
    min-height: 100%;
  }

  .preview-stack {
    display: grid;
    gap: 10px;
  }

  .preview-block {
    border: 1px solid rgba(100, 78, 53, 0.14);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 236, 221, 0.72));
    padding: 14px;
    text-align: left;
    cursor: pointer;
    display: grid;
    gap: 6px;
    font: inherit;
    color: inherit;
  }

  .preview-block-active {
    border-color: rgba(184, 92, 47, 0.38);
    background: linear-gradient(180deg, rgba(255, 237, 215, 0.96), rgba(255, 253, 248, 0.98));
    box-shadow: inset 0 0 0 1px rgba(184, 92, 47, 0.12);
  }

  .preview-block-label {
    font-family: "Space Grotesk", "Avenir Next Condensed", sans-serif;
    color: var(--ink);
  }

  .preview-block-path {
    color: var(--muted);
    font-size: 13px;
  }

  .preview-detail {
    background: rgba(255, 251, 245, 0.74);
  }

  .timeline-action-button {
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    text-align: left;
    color: inherit;
    display: grid;
    gap: 4px;
    cursor: pointer;
    font: inherit;
  }

  .diff-header {
    background: linear-gradient(180deg, rgba(255, 229, 200, 0.9), rgba(255, 253, 248, 0.96));
  }

  .approval-card {
    background: linear-gradient(180deg, rgba(184, 92, 47, 0.12), rgba(255, 253, 248, 0.96));
    border-color: rgba(184, 92, 47, 0.22);
  }

  .approval-success-card {
    background: linear-gradient(180deg, rgba(47, 106, 73, 0.14), rgba(255, 253, 248, 0.96));
    border-color: rgba(47, 106, 73, 0.24);
  }

  .approval-reject-card {
    background: linear-gradient(180deg, rgba(155, 60, 45, 0.12), rgba(255, 253, 248, 0.96));
    border-color: rgba(155, 60, 45, 0.22);
  }

  .approval-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .approval-reason-field {
    display: grid;
    gap: 8px;
    margin-top: 12px;
    color: var(--ink);
    font-size: 14px;
  }

  .approval-reason-input {
    width: 100%;
    min-height: 88px;
    border-radius: 16px;
    border: 1px solid rgba(155, 60, 45, 0.18);
    background: rgba(255, 255, 255, 0.88);
    padding: 12px 14px;
    font: inherit;
    color: inherit;
    resize: vertical;
  }

  .approval-reason-input:focus {
    outline: none;
    border-color: rgba(184, 92, 47, 0.44);
    box-shadow: 0 0 0 4px rgba(184, 92, 47, 0.12);
  }

  .approval-button {
    border: 0;
    border-radius: 999px;
    padding: 10px 14px;
    font: inherit;
    cursor: pointer;
  }

  .approve-button {
    background: var(--success);
    color: #fffdf8;
  }

  .reject-button {
    background: var(--danger);
    color: #fffdf8;
  }

  .code-block pre {
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: "SFMono-Regular", "Menlo", monospace;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink);
  }

  .subgrid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rail-grid,
  .summary-grid,
  .workbench-grid {
    display: grid;
    gap: 14px;
  }

  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .workbench-grid {
    grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
    align-items: start;
  }

  .workbench-grid .preview-card,
  .workbench-grid .diff-card {
    grid-column: 2;
  }

  .workbench-grid .diff-card {
    align-self: stretch;
  }

  .section-card {
    display: grid;
    gap: 12px;
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .section-title h3,
  .section-title p {
    margin: 0;
  }

  .info-pair {
    display: grid;
    gap: 4px;
  }

  .info-pair strong {
    color: var(--ink);
  }

  .muted-note {
    font-size: 13px;
    color: var(--muted);
  }

  @media (max-width: 1120px) {
    .topbar,
    .layout {
      grid-template-columns: 1fr;
    }

    .summary-grid,
    .workbench-grid,
    .subgrid {
      grid-template-columns: 1fr;
    }

    .workbench-grid .preview-card,
    .workbench-grid .diff-card {
      grid-column: auto;
    }
  }

  @media (max-width: 720px) {
    .app-shell {
      padding: 18px 14px 28px;
    }

    .panel,
    .topbar {
      padding: 16px;
      border-radius: 22px;
    }

    .topbar-copy h1 {
      font-size: 30px;
    }

    .hero-stat {
      min-width: 0;
      flex: 1 1 120px;
    }
  }
`;

export function renderWebAppBody(input: WebAppBootstrap): string {
  const shell = createWebAppShell(input);
  const { workbench } = shell;
  const uniqueFiles = [...new Set([...workbench.files, ...(workbench.selectedBlockFile ? [workbench.selectedBlockFile] : [])])];

  return `
    <main class="app-shell">
      <div class="shell-frame">
        <header class="topbar">
          <div class="topbar-copy">
            <div>
              <p class="eyebrow">AI IDE Workbench</p>
              <h1>${escapeHtml(shell.topBar.projectName)}</h1>
            </div>
            <p class="topbar-summary">
              Protocol events, patch review, and block-scoped page editing are now grouped into a clearer operator surface instead of flat cards.
            </p>
            <div class="hero-meta">
              <div class="hero-stat">
                <span class="eyebrow">Runtime</span>
                <strong>${escapeHtml(shell.topBar.runtimeType)}</strong>
              </div>
              <div class="hero-stat">
                <span class="eyebrow">Actions</span>
                <strong>${escapeHtml(String(workbench.actions.length))}</strong>
              </div>
              <div class="hero-stat">
                <span class="eyebrow">Preview Ports</span>
                <strong>${escapeHtml(String(workbench.previews.length))}</strong>
              </div>
            </div>
          </div>
          <div class="topbar-side">
            <div class="topbar-status">
              <p class="eyebrow">Current Focus</p>
              <strong>${escapeHtml(workbench.selectedBlock?.label ?? "No block selected")}</strong>
              <p>${escapeHtml(workbench.selectedBlock?.selector ?? "Select a block to inspect the current editing context.")}</p>
            </div>
            <div class="card">
              <p class="eyebrow">Workspace Panels</p>
              <div class="pill-row">
                ${shell.centerPanels
                  .concat(shell.rightPanels)
                  .map((panel) => `<span class="pill">${escapeHtml(workspacePanelLabels[panel])}</span>`)
                  .join("")}
              </div>
            </div>
          </div>
        </header>

        <section class="layout">
          <aside class="panel stack">
            <div class="panel-head">
              <p class="eyebrow">Project Rail</p>
              <h2>Context and Scope</h2>
            </div>
            <div class="rail-grid">
              <div class="card section-card">
                <div class="info-pair">
                  <span class="eyebrow">Project ID</span>
                  <strong>${escapeHtml(input.projectId)}</strong>
                </div>
                <p class="muted-note">Monorepo session state and runtime outputs are anchored to this project scope.</p>
              </div>
              <div class="card section-card">
                <div class="info-pair">
                  <span class="eyebrow">Session ID</span>
                  <strong>${escapeHtml(input.sessionId)}</strong>
                </div>
                <p class="muted-note">Interactive web edits, approvals, and generated patches all resolve under this session.</p>
              </div>
              <div class="card section-card">
                <div class="info-pair">
                  <span class="eyebrow">Panel Groups</span>
                  <strong>${escapeHtml(`${shell.centerPanels.length} center / ${shell.rightPanels.length} workbench`)}</strong>
                </div>
                <p class="muted-note">Center keeps decision flow; right side stays dedicated to assets, preview, and diff review.</p>
              </div>
              <div class="card section-card">
                <p class="eyebrow">Tracked Files</p>
                <ul class="message-list">
                  ${uniqueFiles.length > 0
                    ? uniqueFiles
                        .map(
                          (file) => `
                            <li class="${file === workbench.selectedBlockFile ? "selected-item" : ""}">
                              ${escapeHtml(file)}
                            </li>
                          `,
                        )
                        .join("")
                    : `<li class="empty-state">No files tracked yet</li>`}
                </ul>
              </div>
            </div>
          </aside>

          <section class="panel stack">
            <div class="panel-head">
              <p class="eyebrow">Operator Flow</p>
              <h2>Conversation, Planning, Edits</h2>
            </div>
            <div class="summary-grid">
              <div class="card section-card">
                <span class="eyebrow">Messages</span>
                <h3>${escapeHtml(String(workbench.chatMessages.length))}</h3>
                <p>Latest protocol-backed conversation state.</p>
              </div>
              <div class="card section-card">
                <span class="eyebrow">Plan Steps</span>
                <h3>${escapeHtml(String(workbench.plan.length))}</h3>
                <p>Execution steps with status and approval markers.</p>
              </div>
              <div class="card section-card">
                <span class="eyebrow">Patch Actions</span>
                <h3>${escapeHtml(String(workbench.patchActions.length))}</h3>
                <p>Generated diffs ready for review and replacement.</p>
              </div>
            </div>
            <section class="card section-card">
              <div class="section-title">
                <div>
                  <p class="eyebrow">ChatPanel</p>
                  <h3>Recent Messages</h3>
                </div>
              </div>
              <ul class="message-list">
                ${workbench.chatMessages.length > 0
                  ? workbench.chatMessages
                      .map(
                        (message) => `
                          <li class="card">
                            <div class="message-role">${escapeHtml(message.role)}</div>
                            <div>${escapeHtml(message.content)}</div>
                          </li>
                        `,
                      )
                      .join("")
                  : `<li class="empty-state">No chat messages yet</li>`}
              </ul>
            </section>

            <section class="card section-card">
              <div class="section-title">
                <div>
                  <p class="eyebrow">PlanPanel</p>
                  <h3>Execution Plan</h3>
                </div>
              </div>
              <ul class="message-list">
                ${workbench.plan.length > 0
                  ? workbench.plan
                      .map(
                        (step) => `
                          <li class="card">
                            <div class="pill-row">
                              <span class="pill">${escapeHtml(renderPlanStatus(step.status))}</span>
                              ${step.requiresApproval ? `<span class="pill">approval</span>` : ""}
                            </div>
                            <h3>${escapeHtml(step.title)}</h3>
                            <p>${escapeHtml(step.description ?? "No description")}</p>
                          </li>
                        `,
                      )
                      .join("")
                  : `<li class="empty-state">No plan steps yet</li>`}
              </ul>
            </section>

            <section class="section-card">
              <div class="section-title">
                <div>
                  <p class="eyebrow">InteractionPanel</p>
                  <h3>Pending Decision</h3>
                </div>
              </div>
              ${renderPendingInteraction(workbench.pendingInteraction)}
            </section>

            <section class="section-card">
              ${renderWebEditor(workbench.webEditor)}
            </section>

            <section class="card section-card">
              <div class="section-title">
                <div>
                  <p class="eyebrow">ActionTimeline</p>
                  <h3>Execution History</h3>
                </div>
              </div>
              <ul class="message-list">
                ${workbench.actions.length > 0
                  ? workbench.actions
                      .map(
                        (action) => `
                          <li class="card ${action.id === workbench.selectedDiffAction?.id ? "selected-item" : ""}">
                            <div class="pill-row">
                              <span class="pill">${escapeHtml(action.source)}</span>
                              <span class="pill status">${escapeHtml(action.status)}</span>
                            </div>
                            ${
                              action.action.type === "file.patch"
                                ? `
                                  <button
                                    type="button"
                                    class="timeline-action-button"
                                    data-diff-action-id="${escapeHtml(action.id)}"
                                  >
                                    <h3>${escapeHtml(action.action.type)}</h3>
                                    <p>${escapeHtml(summarizeAction(action.action))}</p>
                                  </button>
                                `
                                : `
                                  <h3>${escapeHtml(action.action.type)}</h3>
                                  <p>${escapeHtml(summarizeAction(action.action))}</p>
                                `
                            }
                          </li>
                        `,
                      )
                      .join("")
                  : `<li class="empty-state">No actions recorded</li>`}
              </ul>
            </section>
          </section>

          <section class="panel stack">
            <div class="panel-head">
              <p class="eyebrow">Workbench Surface</p>
              <h2>Preview, Editor, Diff</h2>
            </div>
            <div class="workbench-grid">
              <div class="card section-card">
                <div class="section-title">
                  <div>
                    <p class="eyebrow">EditorPanel</p>
                    <h3>Focused Block</h3>
                  </div>
                </div>
                <p>${escapeHtml(
                  workbench.selectedBlock
                    ? `Focused block: ${workbench.selectedBlock.label} -> ${workbench.selectedBlock.selector}`
                    : "Use this slot for a code editor bound to the active file selection.",
                )}</p>
              </div>
              <div class="card section-card preview-card">
                <div class="section-title">
                  <div>
                    <p class="eyebrow">PreviewPanel</p>
                    <h3>Live Surface</h3>
                  </div>
                </div>
                ${
                  workbench.previews.length > 0
                    ? `
                      <ul class="message-list">
                        ${workbench.previews
                          .map(
                            (preview) => `
                              <li class="card">
                                <strong>${escapeHtml(preview.url)}</strong>
                                <p>Port ${escapeHtml(String(preview.port))}</p>
                              </li>
                            `,
                          )
                          .join("")}
                      </ul>
                      ${renderPreviewSelection(workbench.webEditor)}
                    `
                    : `<div class="empty-state">No live preview yet</div>`
                }
              </div>
              <div class="card section-card">
                <div class="section-title">
                  <div>
                    <p class="eyebrow">TerminalPanel</p>
                    <h3>Runtime Output</h3>
                  </div>
                </div>
                <p>Runtime command output will stream into this panel once the browser runtime is real.</p>
              </div>
              <div class="card section-card diff-card">
                <div class="section-title">
                  <div>
                    <p class="eyebrow">DiffPanel</p>
                    <h3>Patch Review</h3>
                  </div>
                </div>
                ${renderDiffPanel(workbench)}
              </div>
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
