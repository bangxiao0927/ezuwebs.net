import { bootstrapBlockEditDemo } from "@ezu/agent";

import { createDemoBootstrap } from "./demo";
import {
  createInteractiveWebEditorState,
  createInteractiveWebEditResponse,
  getWebEditorBlockFile,
  renderWebAppBody,
  selectInteractiveWebEditorBlock,
  upsertInteractiveWebEditorProperty,
  webAppStyles,
  type InteractiveWebEditRequest,
  type WebAppBootstrap,
} from "./index";

function ensureStyles(documentRef: Document): void {
  const existing = documentRef.getElementById("web-app-styles");

  if (existing) {
    existing.textContent = webAppStyles;
    return;
  }

  const style = documentRef.createElement("style");
  style.id = "web-app-styles";
  style.textContent = webAppStyles;
  documentRef.head.appendChild(style);
}

function getSelectedBlock(bootstrap: WebAppBootstrap) {
  const editorState = createInteractiveWebEditorState(bootstrap.webEditor);
  const blocks = editorState.blocks;
  const selectedBlockId = editorState.selectedBlockId;

  return blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];
}

export async function mountDemoApp(target: HTMLElement = document.body): Promise<void> {
  const bootstrap = await createDemoBootstrap();
  const documentRef = target.ownerDocument;
  let blockEditRun = 0;

  ensureStyles(documentRef);

  const render = () => {
    target.innerHTML = renderWebAppBody(bootstrap);

    target.querySelectorAll<HTMLButtonElement>("[data-block-id]").forEach((button) => {
      button.addEventListener("click", () => {
        bootstrap.webEditor = selectInteractiveWebEditorBlock(
          createInteractiveWebEditorState(bootstrap.webEditor),
          button.dataset.blockId ?? "",
        );
        render();
      });
    });

    target.querySelectorAll<HTMLButtonElement>("[data-preview-block-id]").forEach((button) => {
      button.addEventListener("click", () => {
        bootstrap.webEditor = selectInteractiveWebEditorBlock(
          createInteractiveWebEditorState(bootstrap.webEditor),
          button.dataset.previewBlockId ?? "",
        );
        render();
      });
    });

    const form = target.querySelector<HTMLFormElement>("[data-editor-form='interactive-web-editor']");

    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const selectedBlock = getSelectedBlock(bootstrap);
      const runId = ++blockEditRun;
      const request: InteractiveWebEditRequest = {
        selection: {
          blockId: selectedBlock?.id ?? "hero",
          path: String(formData.get("path") ?? selectedBlock?.selector ?? ""),
        },
        intent: String(formData.get("intent") ?? ""),
        patchStrategy:
          (String(formData.get("patchStrategy") ?? "refine") as InteractiveWebEditRequest["patchStrategy"]),
        properties: createInteractiveWebEditorState(bootstrap.webEditor).properties.map((property) => ({
          ...property,
          value: String(formData.get(`property:${property.key}`) ?? property.value),
        })),
      };

      let nextState = createInteractiveWebEditorState(bootstrap.webEditor);

      for (const property of request.properties ?? []) {
        nextState = upsertInteractiveWebEditorProperty(nextState, property);
      }

      const editResponse = createInteractiveWebEditResponse(request, nextState);
      bootstrap.webEditor = editResponse.nextState;
      render();

      const agentEvents = await bootstrapBlockEditDemo({
        sessionId: `demo-session-block-${runId}`,
        projectId: bootstrap.projectId,
        blockId: request.selection.blockId,
        targetPath: getWebEditorBlockFile(request.selection.blockId),
        suggestedPrompt: editResponse.suggestedPrompt,
      });

      if (runId !== blockEditRun) {
        return;
      }

      bootstrap.initialEvents = [...bootstrap.initialEvents, ...agentEvents];
      render();
    });
  };

  render();
}

if (typeof document !== "undefined" && document.body) {
  void mountDemoApp(document.body);
}
