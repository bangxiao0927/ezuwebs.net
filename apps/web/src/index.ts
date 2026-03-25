import { applyAgentEvent, createSessionState } from "@ezu/core";
import {
  centerWorkspacePanels,
  rightWorkbenchPanels,
  workspacePanelLabels,
} from "@ezu/ui";
import { type ActionState, type AgentEvent, type PendingInteraction } from "@ezu/protocol";

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
    --bg: #f5f1e8;
    --panel: #fffaf0;
    --panel-strong: #f1e8d3;
    --ink: #1a1712;
    --muted: #5f5545;
    --line: #d4c6ad;
    --accent: #b3541e;
    --accent-soft: #f6d8b8;
    --success: #386641;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "Iowan Old Style", "Palatino Linotype", serif;
    background:
      radial-gradient(circle at top left, rgba(179, 84, 30, 0.18), transparent 24%),
      linear-gradient(180deg, #efe6d2 0%, var(--bg) 38%, #ede6da 100%);
    color: var(--ink);
  }

  .app-shell {
    min-height: 100vh;
    padding: 24px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 18px 22px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(255, 250, 240, 0.85);
    backdrop-filter: blur(12px);
  }

  .topbar h1,
  .panel h2,
  .card h3 {
    margin: 0;
    font-family: "Avenir Next Condensed", "Franklin Gothic Medium", sans-serif;
    letter-spacing: 0.02em;
  }

  .topbar p,
  .card p,
  .meta,
  li,
  .pill {
    margin: 0;
    color: var(--muted);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(220px, 0.75fr) minmax(320px, 1.1fr) minmax(320px, 1fr);
    gap: 18px;
    margin-top: 18px;
  }

  .panel {
    border: 1px solid var(--line);
    border-radius: 20px;
    background: rgba(255, 250, 240, 0.88);
    padding: 18px;
    box-shadow: 0 10px 30px rgba(61, 42, 18, 0.06);
  }

  .stack {
    display: grid;
    gap: 14px;
  }

  .card {
    padding: 14px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid rgba(212, 198, 173, 0.75);
  }

  .accent-card {
    background: linear-gradient(180deg, var(--accent-soft), rgba(255, 250, 240, 0.96));
  }

  .eyebrow {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
  }

  .pill-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pill {
    display: inline-flex;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(241, 232, 211, 0.75);
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
    gap: 10px;
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
    border-radius: 16px;
    border: 1px dashed var(--line);
    color: var(--muted);
    background: rgba(255, 250, 240, 0.65);
  }

  .selected-item {
    padding: 10px;
    border-radius: 12px;
    background: rgba(179, 84, 30, 0.08);
    border: 1px solid rgba(179, 84, 30, 0.18);
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
    border: 1px solid rgba(95, 85, 69, 0.28);
    border-radius: 12px;
    padding: 10px 12px;
    background: rgba(255, 250, 240, 0.9);
    font: inherit;
    color: var(--ink);
  }

  .submit-button {
    border: 0;
    border-radius: 999px;
    padding: 12px 16px;
    background: var(--accent);
    color: #fffaf0;
    font: inherit;
    cursor: pointer;
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
    border: 1px solid rgba(95, 85, 69, 0.18);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(255, 250, 240, 0.96), rgba(241, 232, 211, 0.68));
    padding: 14px;
    text-align: left;
    cursor: pointer;
    display: grid;
    gap: 6px;
    font: inherit;
    color: inherit;
  }

  .preview-block-active {
    border-color: rgba(179, 84, 30, 0.45);
    background: linear-gradient(180deg, rgba(246, 216, 184, 0.92), rgba(255, 250, 240, 0.98));
    box-shadow: inset 0 0 0 1px rgba(179, 84, 30, 0.15);
  }

  .preview-block-label {
    font-family: "Avenir Next Condensed", "Franklin Gothic Medium", sans-serif;
    color: var(--ink);
  }

  .preview-block-path {
    color: var(--muted);
    font-size: 13px;
  }

  .preview-detail {
    background: rgba(255, 250, 240, 0.78);
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
    background: linear-gradient(180deg, rgba(246, 216, 184, 0.82), rgba(255, 250, 240, 0.96));
  }

  .approval-card {
    background: linear-gradient(180deg, rgba(179, 84, 30, 0.14), rgba(255, 250, 240, 0.96));
    border-color: rgba(179, 84, 30, 0.28);
  }

  .approval-success-card {
    background: linear-gradient(180deg, rgba(56, 102, 65, 0.16), rgba(255, 250, 240, 0.96));
    border-color: rgba(56, 102, 65, 0.28);
  }

  .approval-reject-card {
    background: linear-gradient(180deg, rgba(140, 46, 36, 0.14), rgba(255, 250, 240, 0.96));
    border-color: rgba(140, 46, 36, 0.22);
  }

  .approval-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .approval-button {
    border: 0;
    border-radius: 999px;
    padding: 10px 14px;
    font: inherit;
    cursor: pointer;
  }

  .approve-button {
    background: #386641;
    color: #fffaf0;
  }

  .reject-button {
    background: #8c2e24;
    color: #fffaf0;
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

  @media (max-width: 1120px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .subgrid {
      grid-template-columns: 1fr;
    }
  }
`;

export function renderWebAppBody(input: WebAppBootstrap): string {
  const shell = createWebAppShell(input);
  const { workbench } = shell;

  return `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">AI IDE Workbench</p>
          <h1>${escapeHtml(shell.topBar.projectName)}</h1>
          <p>Runtime: ${escapeHtml(shell.topBar.runtimeType)}</p>
        </div>
        <div class="pill-row">
          ${shell.centerPanels
            .concat(shell.rightPanels)
            .map((panel) => `<span class="pill">${escapeHtml(workspacePanelLabels[panel])}</span>`)
            .join("")}
        </div>
      </header>

      <section class="layout">
        <aside class="panel stack">
          <div>
            <p class="eyebrow">Navigation</p>
            <h2>Project Context</h2>
          </div>
          <div class="card">
            <p class="meta">Project ID</p>
            <h3>${escapeHtml(input.projectId)}</h3>
          </div>
          <div class="card">
            <p class="meta">Session ID</p>
            <h3>${escapeHtml(input.sessionId)}</h3>
          </div>
          <div class="card">
            <p class="meta">Panel Groups</p>
            <p>${escapeHtml(`${shell.centerPanels.length} center / ${shell.rightPanels.length} workbench`)}</p>
          </div>
        </aside>

        <section class="panel stack">
          <div>
            <p class="eyebrow">Center Workspace</p>
            <h2>Conversation, Plan, Interaction</h2>
          </div>
          <section class="stack">
            <div class="card">
              <p class="eyebrow">ChatPanel</p>
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
            </div>

            <div class="card">
              <p class="eyebrow">PlanPanel</p>
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
            </div>

            <div>
              <p class="eyebrow">InteractionPanel</p>
              ${renderPendingInteraction(workbench.pendingInteraction)}
            </div>

            <div>
              ${renderWebEditor(workbench.webEditor)}
            </div>

            <div class="card">
              <p class="eyebrow">ActionTimeline</p>
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
            </div>
          </section>
        </section>

        <section class="panel stack">
          <div>
            <p class="eyebrow">Right Workbench</p>
            <h2>Files, Editor, Preview</h2>
          </div>
          <div class="subgrid">
            <div class="card">
              <p class="eyebrow">FileTree</p>
              <ul class="message-list">
                ${[...new Set([...workbench.files, ...(workbench.selectedBlockFile ? [workbench.selectedBlockFile] : [])])]
                  .map(
                    (file) => `
                      <li class="${file === workbench.selectedBlockFile ? "selected-item" : ""}">
                        ${escapeHtml(file)}
                      </li>
                    `,
                  )
                  .join("")}
              </ul>
            </div>
            <div class="card">
              <p class="eyebrow">PreviewPanel</p>
              ${
                workbench.previews.length > 0
                  ? `
                    <ul class="message-list">
                      ${workbench.previews
                        .map(
                          (preview) => `
                            <li>
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
            <div class="card">
              <p class="eyebrow">EditorPanel</p>
              <p>${escapeHtml(
                workbench.selectedBlock
                  ? `Focused block: ${workbench.selectedBlock.label} -> ${workbench.selectedBlock.selector}`
                  : "Use this slot for a code editor bound to the active file selection.",
              )}</p>
            </div>
            <div class="card">
              <p class="eyebrow">TerminalPanel</p>
              <p>Runtime command output will stream into this panel once the browser runtime is real.</p>
            </div>
            <div class="card">
              <p class="eyebrow">DiffPanel</p>
              ${renderDiffPanel(workbench)}
            </div>
          </div>
        </section>
      </section>
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
