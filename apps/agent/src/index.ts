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
