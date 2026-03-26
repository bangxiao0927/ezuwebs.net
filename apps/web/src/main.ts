import { bootstrapBlockEditDemo, bootstrapReplacementBlockEditDemo } from "@ezu/agent";

import { createDemoBootstrap } from "./demo";
import {
  createWorkbenchViewModel,
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
import { createReplacementPrompt } from "./replacement.js";

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

    target.querySelectorAll<HTMLButtonElement>("[data-diff-action-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const diffActionId = button.dataset.diffActionId;

        if (diffActionId) {
          bootstrap.selectedDiffActionId = diffActionId;
        } else {
          delete bootstrap.selectedDiffActionId;
        }

        render();
      });
    });

    target.querySelectorAll<HTMLButtonElement>("[data-approval-decision]").forEach((button) => {
      button.addEventListener("click", async () => {
        const decision = button.dataset.approvalDecision;
        const rejectionReasonInput = target.querySelector<HTMLTextAreaElement>("[data-reject-reason]");
        const rejectionReason = rejectionReasonInput?.value.trim() ?? "";

        if (!decision) {
          return;
        }

        if (decision === "rejected" && !rejectionReason) {
          window.alert("Reject reason is required before creating a replacement patch.");
          rejectionReasonInput?.focus();
          return;
        }

        const approvalEvent = bootstrap.initialEvents
          .slice()
          .reverse()
          .find(
            (event): event is Extract<WebAppBootstrap["initialEvents"][number], { type: "interaction.required" }> =>
              event.type === "interaction.required",
          );
        const selectedTitle =
          approvalEvent?.interaction.type === "confirm"
            ? approvalEvent.interaction.title
            : "Patch review";
        const selectedSummary =
          approvalEvent?.interaction.type === "confirm"
            ? approvalEvent.interaction.summary
            : "Review the current patch before applying it.";
        const workbench = createWorkbenchViewModel(bootstrap);
        const selectedPatch = workbench.selectedDiffAction;
        const selectedBlock = getSelectedBlock(bootstrap);

        if (approvalEvent?.interaction.type !== "confirm") {
          return;
        }

        bootstrap.initialEvents = [
          ...bootstrap.initialEvents,
          {
            type: "interaction.resolved",
            interactionId: approvalEvent.interaction.id,
            status: decision === "approved" ? "approved" : "rejected",
            title: selectedTitle,
            summary:
              decision === "approved"
                ? `Approved: ${selectedSummary}`
                : `Rejected: ${selectedSummary}${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
            ...(decision === "rejected" ? { rejectionReason } : {}),
            ...(decision === "rejected"
              ? { followUpStrategy: "replace_structure" as const }
              : {}),
          },
        ];

        if (decision === "rejected" && selectedPatch && selectedBlock) {
          bootstrap.initialEvents = [
            ...bootstrap.initialEvents,
            {
              type: "action.updated",
              action: {
                ...selectedPatch,
                status: "superseded",
                updatedAt: new Date().toISOString(),
              },
            },
          ];

          const replacementEvents = await bootstrapReplacementBlockEditDemo({
            sessionId: `${bootstrap.sessionId}-replacement-${Date.now()}`,
            projectId: bootstrap.projectId,
            blockId: selectedBlock.id,
            targetPath: getWebEditorBlockFile(selectedBlock.id),
            suggestedPrompt: createReplacementPrompt(
              createInteractiveWebEditorState(bootstrap.webEditor).suggestedPrompt ??
                "Replace the rejected block structure.",
              rejectionReason,
            ),
            rejectedPatch: selectedPatch.action.patch,
            rejectionReason,
          });

          bootstrap.initialEvents = [...bootstrap.initialEvents, ...replacementEvents];

          const replacementPatchAction = [...replacementEvents]
            .reverse()
            .find((event) => event.type === "action.created" && event.action.action.type === "file.patch");

          if (replacementPatchAction && replacementPatchAction.type === "action.created") {
            bootstrap.selectedDiffActionId = replacementPatchAction.action.id;
          }
        }

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
      const latestPatchAction = [...agentEvents]
        .reverse()
        .find((event) => event.type === "action.created" && event.action.action.type === "file.patch");

      if (latestPatchAction && latestPatchAction.type === "action.created") {
        bootstrap.selectedDiffActionId = latestPatchAction.action.id;
      }

      render();
    });
  };

  render();
}

if (typeof document !== "undefined" && document.body) {
  void mountDemoApp(document.body);
}
