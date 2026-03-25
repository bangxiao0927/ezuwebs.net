import {
  applyAgentEvent,
  collectEventStream,
  createExecutor,
  createSessionState,
  createSessionStore,
  createTimelineAction,
} from "@ezu/core";
import { createModelGateway } from "@ezu/model-gateway";
import { type AgentEvent } from "@ezu/protocol";
import { createBrowserRuntimeStub } from "@ezu/runtime-browser";

export interface AgentAppOptions {
  sessionId: string;
  projectId: string;
}

export interface BlockEditDemoOptions extends AgentAppOptions {
  blockId: string;
  targetPath: string;
  suggestedPrompt: string;
}

function applyEvent(session: ReturnType<typeof createSessionState>, events: AgentEvent[], event: AgentEvent) {
  events.push(event);
  return applyAgentEvent(session, event);
}

export async function bootstrapBlockEditDemo(
  options: BlockEditDemoOptions,
): Promise<AgentEvent[]> {
  const sessionStore = createSessionStore();
  let session = createSessionState({
    id: options.sessionId,
    projectId: options.projectId,
  });
  const events: AgentEvent[] = [];

  sessionStore.upsert(session);

  const gateway = createModelGateway();
  const runtime = createBrowserRuntimeStub();
  const executor = createExecutor({ runtime, sessionStore });
  const messageId = crypto.randomUUID();

  session = applyEvent(session, events, {
    type: "message.delta",
    messageId,
    text: `Planner is translating the ${options.blockId} block edit request into executable steps.`,
  });

  session = applyEvent(session, events, {
    type: "plan.updated",
    plan: [
      {
        id: crypto.randomUUID(),
        title: `Inspect the ${options.blockId} block`,
        description: `Use the suggested prompt to focus changes on ${options.targetPath}.`,
        status: "completed",
      },
      {
        id: crypto.randomUUID(),
        title: "Generate a block-scoped patch action",
        description: "Produce a safe file.patch demo action from the block editor request.",
        status: "in_progress",
      },
      {
        id: crypto.randomUUID(),
        title: "Replay the resulting changes in the workbench",
        description: "Expose the block edit as action, file, and preview events.",
        status: "pending",
      },
    ],
  });

  session = applyEvent(session, events, {
    type: "message.delta",
    messageId,
    text: ` Prompt: ${options.suggestedPrompt}`,
  });

  const coderStream = gateway.streamCode({
    prompt: options.suggestedPrompt,
  });
  const { session: codedSession, events: codedEvents } = await collectEventStream(session, coderStream);
  session = codedSession;
  events.push(...codedEvents);

  const fileAction = createTimelineAction({
    source: "coder",
    action: {
      type: "file.patch",
      path: options.targetPath,
      patch: [
        `// block-edit:${options.blockId}`,
        "export const blockEditPatchPreview = {",
        `  blockId: '${options.blockId}',`,
        `  targetPath: '${options.targetPath}',`,
        `  prompt: ${JSON.stringify(options.suggestedPrompt)},`,
        `  coderModel: '${gateway.getProfile().coding.model}',`,
        "};",
      ].join("\n"),
    },
  });

  session = applyEvent(session, events, {
    type: "action.created",
    action: fileAction,
  });

  const completedFileAction = await executor.enqueue(fileAction);
  session = applyEvent(session, events, {
    type: "action.updated",
    action: completedFileAction,
  });

  session = applyEvent(session, events, {
    type: "file.changed",
    path: options.targetPath,
  });

  session = applyEvent(session, events, {
    type: "preview.ready",
    url: `http://localhost:4173?block=${encodeURIComponent(options.blockId)}`,
    port: 4173,
  });

  session = applyEvent(session, events, {
    type: "message.completed",
    messageId,
  });

  sessionStore.upsert(session);

  return events;
}

export async function bootstrapAgentApp(options: AgentAppOptions): Promise<AgentEvent[]> {
  const sessionStore = createSessionStore();
  let session = createSessionState({
    id: options.sessionId,
    projectId: options.projectId,
  });

  sessionStore.upsert(session);

  const gateway = createModelGateway();
  const runtime = createBrowserRuntimeStub();
  const executor = createExecutor({ runtime, sessionStore });
  const { session: plannedSession, events } = await collectEventStream(
    session,
    gateway.streamPlan({
      prompt: "Initialize the workspace code structure for the new AI IDE.",
    }),
  );

  session = plannedSession;
  sessionStore.upsert(session);

  const fileAction = createTimelineAction({
    source: "coder",
    action: {
      type: "file.write",
      path: "apps/web/src/generated-bootstrap.ts",
      content: [
        "export const generatedBootstrap = {",
        "  status: 'ready',",
        "  source: 'agent-demo',",
        "};",
      ].join("\n"),
    },
  });

  const previewAction = createTimelineAction({
    source: "system",
    action: {
      type: "preview.open",
      port: 4173,
    },
  });

  const createdFileEvent: AgentEvent = {
    type: "action.created",
    action: fileAction,
  };
  events.push(createdFileEvent);
  session = applyAgentEvent(session, createdFileEvent);

  const completedFileAction = await executor.enqueue(fileAction);
  const updatedFileEvent: AgentEvent = {
    type: "action.updated",
    action: completedFileAction,
  };
  events.push(updatedFileEvent);
  session = applyAgentEvent(session, updatedFileEvent);

  const fileChangedEvent: AgentEvent = {
    type: "file.changed",
    path: fileAction.action.path,
  };
  events.push(fileChangedEvent);
  session = applyAgentEvent(session, fileChangedEvent);

  const createdPreviewEvent: AgentEvent = {
    type: "action.created",
    action: previewAction,
  };
  events.push(createdPreviewEvent);
  session = applyAgentEvent(session, createdPreviewEvent);

  const completedPreviewEvent: AgentEvent = {
    type: "action.updated",
    action: {
      ...previewAction,
      status: "completed",
      updatedAt: new Date().toISOString(),
    },
  };
  events.push(completedPreviewEvent);
  session = applyAgentEvent(session, completedPreviewEvent);

  const previewReadyEvent: AgentEvent = {
    type: "preview.ready",
    url: "http://localhost:4173",
    port: 4173,
  };
  events.push(previewReadyEvent);
  session = applyAgentEvent(session, previewReadyEvent);

  const profileMessageEvent: AgentEvent = {
    type: "message.delta",
    messageId: "bootstrap-profile",
    text: `Planner profile: ${gateway.getProfile().planning.model}`,
  };
  events.push(profileMessageEvent);
  session = applyAgentEvent(session, profileMessageEvent);

  const profileCompletedEvent: AgentEvent = {
    type: "message.completed",
    messageId: "bootstrap-profile",
  };
  events.push(profileCompletedEvent);
  session = applyAgentEvent(session, profileCompletedEvent);

  sessionStore.upsert(session);

  return events;
}
