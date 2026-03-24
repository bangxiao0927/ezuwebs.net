import { applyAgentEvent, createSessionState } from "@ezu/core";
import {
  centerWorkspacePanels,
  rightWorkbenchPanels,
  workspacePanelLabels,
} from "@ezu/ui";
import { type AgentEvent, type PendingInteraction } from "@ezu/protocol";

export interface WebAppShellConfig {
  projectName: string;
  runtimeType: "browser" | "remote";
}

export interface WebAppBootstrap {
  config: WebAppShellConfig;
  initialEvents: AgentEvent[];
  sessionId: string;
  projectId: string;
}

export interface WorkbenchViewModel {
  chatMessages: Array<{ id: string; role: string; content: string }>;
  plan: WebAppEventState["plan"];
  actions: WebAppEventState["actions"];
  pendingInteraction: WebAppEventState["pendingInteraction"];
  files: string[];
  previews: WebAppEventState["runtime"]["openPorts"];
}

export interface WebAppEventState {
  messages: ReturnType<typeof createSessionState>["messages"];
  plan: ReturnType<typeof createSessionState>["plan"];
  actions: ReturnType<typeof createSessionState>["actions"];
  pendingInteraction: ReturnType<typeof createSessionState>["pendingInteraction"];
  runtime: ReturnType<typeof createSessionState>["runtime"];
}

export function reduceWorkbenchEvents(
  input: Pick<WebAppBootstrap, "initialEvents" | "projectId" | "sessionId">,
): WebAppEventState {
  const session = input.initialEvents.reduce(
    (currentSession, event) => applyAgentEvent(currentSession, event),
    createSessionState({
      id: input.sessionId,
      projectId: input.projectId,
    }),
  );

  return {
    messages: session.messages,
    plan: session.plan,
    actions: session.actions,
    pendingInteraction: session.pendingInteraction,
    runtime: session.runtime,
  };
}

export function createWorkbenchViewModel(input: WebAppBootstrap): WorkbenchViewModel {
  const state = reduceWorkbenchEvents(input);

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
  };
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

export function renderWebAppDocument(input: WebAppBootstrap): string {
  const shell = createWebAppShell(input);
  const { workbench } = shell;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(shell.topBar.projectName)} Workspace</title>
    <style>
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
    </style>
  </head>
  <body>
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

            <div class="card">
              <p class="eyebrow">ActionTimeline</p>
              <ul class="message-list">
                ${workbench.actions.length > 0
                  ? workbench.actions
                      .map(
                        (action) => `
                          <li class="card">
                            <div class="pill-row">
                              <span class="pill">${escapeHtml(action.source)}</span>
                              <span class="pill status">${escapeHtml(action.status)}</span>
                            </div>
                            <h3>${escapeHtml(action.action.type)}</h3>
                            <p>${escapeHtml(JSON.stringify(action.action))}</p>
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
                ${workbench.files.length > 0
                  ? workbench.files.map((file) => `<li>${escapeHtml(file)}</li>`).join("")
                  : `<li class="empty-state">No files changed yet</li>`}
              </ul>
            </div>
            <div class="card">
              <p class="eyebrow">PreviewPanel</p>
              <ul class="message-list">
                ${workbench.previews.length > 0
                  ? workbench.previews
                      .map(
                        (preview) => `
                          <li>
                            <strong>${escapeHtml(preview.url)}</strong>
                            <p>Port ${escapeHtml(String(preview.port))}</p>
                          </li>
                        `,
                      )
                      .join("")
                  : `<li class="empty-state">No live preview yet</li>`}
              </ul>
            </div>
            <div class="card">
              <p class="eyebrow">EditorPanel</p>
              <p>Use this slot for a code editor bound to the active file selection.</p>
            </div>
            <div class="card">
              <p class="eyebrow">TerminalPanel</p>
              <p>Runtime command output will stream into this panel once the browser runtime is real.</p>
            </div>
            <div class="card">
              <p class="eyebrow">DiffPanel</p>
              <p>Diff summaries will attach to action metadata in a later iteration.</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  </body>
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
