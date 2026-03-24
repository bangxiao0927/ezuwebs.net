import { type AgentEvent } from "@ezu/protocol";

import { createWebAppShell, renderWebAppDocument, type WebAppBootstrap } from "./index";

export function createDemoBootstrap(): WebAppBootstrap {
  const events: AgentEvent[] = [
    {
      type: "message.delta",
      messageId: "planner-demo",
      text: "Planning the first-pass monorepo setup.",
    },
    {
      type: "plan.updated",
      plan: [
        {
          id: "plan-1",
          title: "Define app boundaries",
          description: "Split web, agent, protocol, runtime, and UI packages.",
          status: "completed",
        },
        {
          id: "plan-2",
          title: "Show the workbench shell",
          description: "Render chat, plan, interaction, files, and preview panels.",
          status: "in_progress",
        },
      ],
    },
    {
      type: "interaction.required",
      interaction: {
        type: "confirm",
        id: "confirm-1",
        title: "Render the static web shell",
        summary: "This demo page shows how the protocol-backed state maps into the UI layout.",
      },
    },
    {
      type: "action.created",
      action: {
        id: "action-1",
        source: "coder",
        action: {
          type: "file.write",
          path: "apps/web/src/index.ts",
          content: "renderWebAppDocument(...)",
        },
        status: "completed",
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
    },
    {
      type: "file.changed",
      path: "apps/web/src/index.ts",
    },
    {
      type: "preview.ready",
      url: "http://localhost:4173",
      port: 4173,
    },
    {
      type: "message.completed",
      messageId: "planner-demo",
    },
  ];

  return {
    config: {
      projectName: "ezuwebs.net",
      runtimeType: "browser",
    },
    initialEvents: events,
    sessionId: "demo-session",
    projectId: "demo-project",
  };
}

export function createDemoShell() {
  return createWebAppShell(createDemoBootstrap());
}

export function createDemoDocument(): string {
  return renderWebAppDocument(createDemoBootstrap());
}
