import {
  createInteractiveWebEditResponse,
  createInteractiveWebEditorState,
  getWebEditorBlockFile,
  renderWebAppBody,
  selectInteractiveWebEditorBlock,
  upsertInteractiveWebEditorProperty,
  webAppStyles,
  type InteractiveWebEditRequest,
  type ViewMode,
  type WebAppBootstrap,
} from "./index";
import { createReplacementPrompt } from "./replacement.js";
import { createDemoBootstrap, getDemoSessionDefinition, listDemoSessions } from "./demo";
import { type AgentEvent } from "@ezu/protocol";

type DialogKind = "share" | "publish" | "sessions" | undefined;

type UiState = {
  activeDialog?: DialogKind;
  composerText: string;
  activeFile?: string;
  viewMode: ViewMode;
  toast?: string;
};

function ensureStyles(documentRef: Document): void {
  const existing = documentRef.getElementById("web-app-styles");

  if (existing) {
    existing.textContent = webAppStyles;
    return;
  }

  const style = documentRef.createElement("style");
  style.id = "web-app-styles";
  style.textContent = webAppStyles;
  documentRef.head.append(style);
}

function getSessionIdFromLocation(locationRef: Location): string | undefined {
  const hash = locationRef.hash.replace(/^#/, "");

  if (hash.startsWith("/session/")) {
    return hash.slice("/session/".length) || undefined;
  }

  const searchSession = new URLSearchParams(locationRef.search).get("session");
  return searchSession ?? undefined;
}

function setSessionHash(sessionId: string): void {
  if (location.hash !== `#/session/${sessionId}`) {
    location.hash = `/session/${sessionId}`;
  }
}

function renderSessionLauncher(): string {
  const sessionCards = listDemoSessions()
    .map(
      (session) => `
        <div class="launcher-card">
          <p class="eyebrow">Session</p>
          <h2>${session.title}</h2>
          <p>${session.description}</p>
          <span class="launcher-meta">${session.taskTitle}</span>
          <button class="launcher-button" data-open-session="${session.id}" type="button">Open Session</button>
        </div>
      `,
    )
    .join("");

  return `
    <main class="launcher-shell">
      <section class="launcher-hero">
        <p class="eyebrow">Session Router</p>
        <h1>Open a workspace per conversation instead of treating the homepage as the workbench.</h1>
        <p class="launcher-copy">
          Each session gets its own IDE-style page with conversation context, files, code, terminal output,
          and an embedded browser runtime preview.
        </p>
        <div class="launcher-actions">
          <button class="launcher-button launcher-button-primary" data-open-session="club-promo" type="button">Open Demo Session</button>
          <button class="launcher-button" data-open-session="agency-redesign" type="button">Open Agency Session</button>
        </div>
      </section>
      <section class="launcher-grid">
        ${sessionCards}
      </section>
    </main>
  `;
}

function attachLauncherStyles(): void {
  const style = document.createElement("style");
  style.dataset.app = "launcher";
  style.textContent = `
    .launcher-shell {
      min-height: 100vh;
      padding: 32px;
      display: grid;
      gap: 24px;
      background: #0d0f14;
      color: #edf2ff;
    }

    .launcher-hero,
    .launcher-card {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      background: rgba(20, 23, 29, 0.92);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    }

    .launcher-hero {
      padding: 28px;
    }

    .launcher-hero h1,
    .launcher-card h2 {
      margin: 10px 0 12px;
      font-family: "Space Grotesk", "Segoe UI", sans-serif;
      letter-spacing: -0.05em;
    }

    .launcher-copy,
    .launcher-card p,
    .launcher-meta {
      color: #9aa4b2;
      line-height: 1.7;
      margin: 0;
    }

    .launcher-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
    }

    .launcher-card {
      padding: 22px;
      color: inherit;
      text-decoration: none;
      display: grid;
      gap: 10px;
    }

    .launcher-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .launcher-button {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #edf2ff;
      padding: 10px 14px;
      cursor: pointer;
    }

    .launcher-button-primary {
      background: #4f8cff;
      border-color: transparent;
      color: white;
    }

    .launcher-card:hover {
      border-color: rgba(79, 140, 255, 0.34);
      transform: translateY(-1px);
    }

    .launcher-meta {
      font-size: 13px;
    }
  `;
  document.head.append(style);
}

function clearEphemeralStyles(): void {
  for (const style of Array.from(document.head.querySelectorAll('style[data-app="launcher"]'))) {
    style.remove();
  }
}

function appendEvent(state: WebAppBootstrap, event: AgentEvent): WebAppBootstrap {
  return {
    ...state,
    initialEvents: [...state.initialEvents, event],
  };
}

async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderDialog(state: WebAppBootstrap, ui: UiState): string {
  if (!ui.activeDialog) {
    return ui.toast ? `<div class="workspace-toast">${ui.toast}</div>` : "";
  }

  const definition = getDemoSessionDefinition(getSessionIdFromLocation(window.location) ?? "club-promo");
  const shareUrl = `${window.location.origin}${window.location.pathname}#/session/${definition.id}`;

  let title = "";
  let body = "";
  let actions = "";

  if (ui.activeDialog === "share") {
    title = "Share Session";
    body = `
      <p>Copy the direct link to this active workspace session.</p>
      <div class="dialog-code">${shareUrl}</div>
    `;
    actions = `
      <button class="dialog-button dialog-button-primary" data-dialog-copy="${shareUrl}" type="button">Copy Link</button>
      <button class="dialog-button" data-close-dialog type="button">Close</button>
    `;
  } else if (ui.activeDialog === "publish") {
    title = "Publish Workspace";
    body = `
      <p>Publish the current session snapshot with the latest code, preview, and patch review state.</p>
      <ul class="dialog-list">
        <li>Project: ${definition.projectName}</li>
        <li>Actions: ${String(state.initialEvents.length)} tracked events</li>
        <li>Runtime: browser preview embedded</li>
      </ul>
    `;
    actions = `
      <button class="dialog-button dialog-button-primary" data-confirm-publish type="button">Publish Snapshot</button>
      <button class="dialog-button" data-close-dialog type="button">Cancel</button>
    `;
  } else if (ui.activeDialog === "sessions") {
    title = "Switch Session";
    body = `
      <p>Move between conversation workspaces without using the homepage as the editor surface.</p>
      <div class="dialog-session-grid">
        ${listDemoSessions()
          .map(
            (session) => `
              <button class="dialog-session-card" data-open-session="${session.id}" type="button">
                <strong>${session.title}</strong>
                <span>${session.taskTitle}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
    actions = `<button class="dialog-button" data-close-dialog type="button">Close</button>`;
  }

  return `
    <div class="workspace-dialog-backdrop" data-close-dialog>
      <div class="workspace-dialog" role="dialog" aria-modal="true" aria-label="${title}" onclick="event.stopPropagation()">
        <div class="workspace-dialog-head">
          <strong>${title}</strong>
          <button class="dialog-close" data-close-dialog type="button">×</button>
        </div>
        <div class="workspace-dialog-body">${body}</div>
        <div class="workspace-dialog-actions">${actions}</div>
      </div>
    </div>
    ${ui.toast ? `<div class="workspace-toast">${ui.toast}</div>` : ""}
  `;
}

function ensureWorkspaceUiStyles(): void {
  document.head.querySelector('style[data-app="workspace-ui"]')?.remove();
  const style = document.createElement("style");
  style.dataset.app = "workspace-ui";
  style.textContent = `
    .workspace-dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(5, 8, 12, 0.72);
      display: grid;
      place-items: center;
      padding: 24px;
      z-index: 50;
    }

    .workspace-dialog {
      width: min(560px, 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      background: #141922;
      color: #edf2ff;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
    }

    .workspace-dialog-head,
    .workspace-dialog-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
    }

    .workspace-dialog-body {
      padding: 0 18px 18px;
      color: #9aa4b2;
      line-height: 1.7;
    }

    .dialog-close,
    .dialog-button,
    .dialog-session-card {
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      cursor: pointer;
    }

    .dialog-close {
      width: 32px;
      height: 32px;
      border-radius: 999px;
    }

    .dialog-button {
      border-radius: 999px;
      padding: 10px 14px;
    }

    .dialog-button-primary {
      background: #4f8cff;
      border-color: transparent;
      color: white;
    }

    .dialog-code {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: #0f1319;
      color: #dce8ff;
      word-break: break-all;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
    }

    .dialog-list {
      margin: 14px 0 0;
      padding-left: 18px;
    }

    .dialog-session-grid {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }

    .dialog-session-card {
      width: 100%;
      text-align: left;
      border-radius: 14px;
      padding: 14px;
      display: grid;
      gap: 6px;
    }

    .dialog-session-card strong {
      color: #edf2ff;
    }

    .dialog-session-card span {
      color: #9aa4b2;
      font-size: 13px;
    }

    .workspace-toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: #141922;
      color: #edf2ff;
      z-index: 60;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
    }
  `;
  document.head.append(style);
}

function attachLauncherListeners(target: HTMLElement): void {
  for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-open-session]"))) {
    button.addEventListener("click", () => {
      const nextId = button.dataset.openSession;

      if (nextId) {
        setSessionHash(nextId);
      }
    });
  }
}

async function mountSessionApp(target: HTMLElement, sessionId: string): Promise<void> {
  const bootstrap = await createDemoBootstrap(sessionId);
  let state = bootstrap;
  let uiState: UiState = {
    composerText: state.composerText ?? "",
    viewMode: "layout",
  };

  const render = () => {
    state = {
      ...state,
      composerText: uiState.composerText,
    };
    const renderState: WebAppBootstrap = {
      ...state,
      activeFile: uiState.activeFile,
      viewMode: uiState.viewMode,
    };
    target.innerHTML = `${renderWebAppBody(renderState)}${renderDialog(state, uiState)}`;

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-block-id]"))) {
      button.addEventListener("click", () => {
        state = {
          ...state,
          webEditor: selectInteractiveWebEditorBlock(
            createInteractiveWebEditorState(state.webEditor),
            button.dataset.blockId ?? "",
          ),
        };
        render();
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-preview-block-id]"))) {
      button.addEventListener("click", () => {
        state = {
          ...state,
          webEditor: selectInteractiveWebEditorBlock(
            createInteractiveWebEditorState(state.webEditor),
            button.dataset.previewBlockId ?? "",
          ),
        };
        render();
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-diff-action-id]"))) {
      button.addEventListener("click", () => {
        const id = button.dataset.diffActionId;
        const filePath = button.dataset.filePath;

        state = {
          ...state,
          ...(id ? { selectedDiffActionId: id } : {}),
        };
        if (filePath) {
          uiState = {
            ...uiState,
            activeFile: filePath,
          };
        }
        render();
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-toolbar-action]"))) {
      button.addEventListener("click", () => {
        const mode = button.dataset.toolbarAction as ViewMode | undefined;

        if (!mode) {
          return;
        }

        uiState = {
          ...uiState,
          viewMode: mode,
        };
        render();
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-file-path]"))) {
      button.addEventListener("click", () => {
        if (button.dataset.diffActionId) {
          return;
        }
        const filePath = button.dataset.filePath;

        if (!filePath) {
          return;
        }

        uiState = {
          ...uiState,
          activeFile: filePath,
        };
        render();
      });
    }

    const form = target.querySelector<HTMLFormElement>('[data-editor-form="interactive-web-editor"]');

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      const selectedState = createInteractiveWebEditorState(state.webEditor);
      const blockId = selectedState.selectedBlockId ?? selectedState.blocks[0]?.id ?? "workbench";
      const formData = new FormData(form);

      const request: InteractiveWebEditRequest = {
        selection: {
          blockId,
          path: getWebEditorBlockFile(blockId),
        },
        intent: String(formData.get("intent") ?? ""),
        patchStrategy: (String(formData.get("patchStrategy") ?? "refine") as InteractiveWebEditRequest["patchStrategy"]),
        properties: selectedState.properties.map((property) => ({
          ...property,
          value: String(formData.get(`property:${property.key}`) ?? property.value),
        })),
      };

      let nextEditorState = createInteractiveWebEditorState(state.webEditor);

      for (const property of request.properties ?? []) {
        nextEditorState = upsertInteractiveWebEditorProperty(nextEditorState, property);
      }

      const response = createInteractiveWebEditResponse(request, nextEditorState);
      state = {
        ...state,
        webEditor: response.nextState,
      };
      render();
    });

    const composer = target.querySelector<HTMLInputElement>("[data-command-input]");
    composer?.addEventListener("input", () => {
      uiState = {
        ...uiState,
        composerText: composer.value,
      };
    });

    const sendPrompt = () => {
      const text = composer?.value.trim() ?? uiState.composerText.trim();

      if (!text) {
        uiState = {
          ...uiState,
          toast: "Type a request before sending.",
        };
        render();
        return;
      }

      const selectedEditor = createInteractiveWebEditorState(state.webEditor);
      const blockId = selectedEditor.selectedBlockId ?? selectedEditor.blocks[0]?.id ?? "workbench";
      const nextRequest: InteractiveWebEditRequest = {
        selection: {
          blockId,
          path: getWebEditorBlockFile(blockId),
        },
        intent: text,
        patchStrategy: "refine",
        properties: selectedEditor.properties,
      };
      const response = createInteractiveWebEditResponse(nextRequest, selectedEditor);

      state = appendEvent(
        {
          ...state,
          webEditor: response.nextState,
        },
        {
          type: "message.delta",
          messageId: `assistant-ui-${Date.now()}`,
          text: `Queued prompt: ${text}`,
        },
      );
      uiState = {
        ...uiState,
        composerText: "",
        toast: "Prompt routed into the active session.",
      };
      render();
    };

    target.querySelector<HTMLButtonElement>("[data-send-message]")?.addEventListener("click", sendPrompt);
    composer?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendPrompt();
      }
    });

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-open-session]"))) {
      button.addEventListener("click", () => {
        const nextId = button.dataset.openSession;

        if (nextId) {
          setSessionHash(nextId);
        }
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-open-dialog]"))) {
      button.addEventListener("click", () => {
        const nextDialog = button.dataset.openDialog as DialogKind;
        uiState = {
          ...uiState,
          activeDialog: nextDialog,
        };
        render();
      });
    }

    for (const element of Array.from(target.querySelectorAll<HTMLElement>("[data-close-dialog]"))) {
      element.addEventListener("click", () => {
        uiState = {
          ...uiState,
          activeDialog: undefined,
        };
        render();
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-dialog-copy]"))) {
      button.addEventListener("click", async () => {
        const ok = await copyText(button.dataset.dialogCopy ?? "");
        uiState = {
          ...uiState,
          activeDialog: undefined,
          toast: ok ? "Session link copied." : "Clipboard unavailable in this browser.",
        };
        render();
      });
    }

    target.querySelector<HTMLButtonElement>("[data-confirm-publish]")?.addEventListener("click", () => {
      uiState = {
        ...uiState,
        activeDialog: undefined,
        toast: "Workspace snapshot marked as published.",
      };
      render();
    });

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-apply-replacement]"))) {
      button.addEventListener("click", () => {
        const selectedEditor = createInteractiveWebEditorState(state.webEditor);
        const selectedBlock =
          selectedEditor.blocks.find((block) => block.id === selectedEditor.selectedBlockId) ??
          selectedEditor.blocks[0];

        if (!selectedBlock || !selectedEditor.lastIntent) {
          return;
        }

        const reason =
          target.querySelector<HTMLTextAreaElement>("[data-reject-reason]")?.value.trim() ??
          "Needs broader structural change.";

        state = {
          ...state,
          webEditor: {
            ...selectedEditor,
            suggestedPrompt: createReplacementPrompt(
              selectedEditor.suggestedPrompt ??
                `Replace block ${selectedBlock.id} at ${getWebEditorBlockFile(selectedBlock.id)}.`,
              reason,
            ),
          },
        };
        render();
      });
    }

    for (const button of Array.from(target.querySelectorAll<HTMLButtonElement>("[data-approval-decision]"))) {
      button.addEventListener("click", () => {
        const decision = button.dataset.approvalDecision;
        const pending = state.initialEvents
          .slice()
          .reverse()
          .find((event): event is Extract<AgentEvent, { type: "interaction.required" }> => event.type === "interaction.required");

        if (!decision || !pending || pending.interaction.type !== "confirm") {
          return;
        }

        const reason =
          target.querySelector<HTMLTextAreaElement>("[data-reject-reason]")?.value.trim() ??
          "Replacement requested.";

        state = appendEvent(state, {
          type: "interaction.resolved",
          interactionId: pending.interaction.id,
          status: decision === "approved" ? "approved" : "rejected",
          title: pending.interaction.title,
          summary:
            decision === "approved"
              ? `Approved: ${pending.interaction.summary}`
              : `Rejected: ${pending.interaction.summary}`,
          ...(decision === "rejected" ? { rejectionReason: reason, followUpStrategy: "replace_structure" as const } : {}),
        });

        if (decision === "rejected") {
          const selectedEditor = createInteractiveWebEditorState(state.webEditor);
          state = {
            ...state,
            webEditor: {
              ...selectedEditor,
              suggestedPrompt: createReplacementPrompt(
                selectedEditor.suggestedPrompt ?? "Replace the current patch.",
                reason,
              ),
            },
          };
        }

        uiState = {
          ...uiState,
          toast: decision === "approved" ? "Patch approved." : "Patch rejected and replacement prompt prepared.",
        };
        render();
      });
    }
  };

  render();
}

async function mount(): Promise<void> {
  ensureStyles(document);
  clearEphemeralStyles();

  const sessionId = getSessionIdFromLocation(window.location);

  if (!sessionId) {
    document.title = "ezuwebs.net | Session Launcher";
    document.body.innerHTML = renderSessionLauncher();
    attachLauncherStyles();
    attachLauncherListeners(document.body);
    return;
  }

  const definition = getDemoSessionDefinition(sessionId);
  document.title = `${definition.projectName} | Session Workspace`;
  ensureWorkspaceUiStyles();
  await mountSessionApp(document.body, sessionId);
}

window.addEventListener("hashchange", () => {
  void mount();
});

void mount();
