import { createDemoBootstrap } from "./demo";
import {
  createInteractiveWebEditorState,
  createInteractiveWebEditResponse,
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
  const blocks = bootstrap.webEditor?.blocks ?? [];
  const selectedBlockId = bootstrap.webEditor?.selectedBlockId;

  return blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];
}

export function mountDemoApp(target: HTMLElement = document.body): void {
  const bootstrap = createDemoBootstrap();
  const documentRef = target.ownerDocument;

  ensureStyles(documentRef);

  const render = () => {
    target.innerHTML = renderWebAppBody(bootstrap);

    target.querySelectorAll<HTMLButtonElement>("[data-block-id]").forEach((button) => {
      button.addEventListener("click", () => {
        bootstrap.webEditor = selectInteractiveWebEditorBlock(
          bootstrap.webEditor ?? createInteractiveWebEditorState(),
          button.dataset.blockId ?? "",
        );
        render();
      });
    });

    target.querySelectorAll<HTMLButtonElement>("[data-preview-block-id]").forEach((button) => {
      button.addEventListener("click", () => {
        bootstrap.webEditor = selectInteractiveWebEditorBlock(
          bootstrap.webEditor ?? createInteractiveWebEditorState(),
          button.dataset.previewBlockId ?? "",
        );
        render();
      });
    });

    const form = target.querySelector<HTMLFormElement>("[data-editor-form='interactive-web-editor']");

    if (!form) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const selectedBlock = getSelectedBlock(bootstrap);
      const request: InteractiveWebEditRequest = {
        selection: {
          blockId: selectedBlock?.id ?? "hero",
          path: String(formData.get("path") ?? selectedBlock?.selector ?? ""),
        },
        intent: String(formData.get("intent") ?? ""),
        patchStrategy:
          (String(formData.get("patchStrategy") ?? "refine") as InteractiveWebEditRequest["patchStrategy"]),
        properties: (bootstrap.webEditor?.properties ?? []).map((property) => ({
          ...property,
          value: String(formData.get(`property:${property.key}`) ?? property.value),
        })),
      };

      let nextState = bootstrap.webEditor ?? {
        ...createInteractiveWebEditorState(),
      };

      for (const property of request.properties ?? []) {
        nextState = upsertInteractiveWebEditorProperty(nextState, property);
      }

      bootstrap.webEditor = createInteractiveWebEditResponse(request, nextState).nextState;
      render();
    });
  };

  render();
}

if (typeof document !== "undefined" && document.body) {
  mountDemoApp(document.body);
}
