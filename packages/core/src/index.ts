import {
  type ActionState,
  type AgentAction,
  type RuntimeSnapshot,
  type SessionState,
} from "@ezu/protocol";

export interface RuntimeProcess {
  id: string;
  kill(): Promise<void>;
  onOutput(cb: (chunk: string) => void): void;
  onExit(cb: (code: number) => void): void;
}

export interface RuntimeAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  patchFile(path: string, patch: string): Promise<void>;
  listFiles(root: string): Promise<string[]>;
  runCommand(command: string, opts?: { cwd?: string }): Promise<RuntimeProcess>;
  watchFiles(cb: (event: { path: string; type: string }) => void): Promise<() => void>;
  watchPorts(
    cb: (event: { port: number; url: string; status: "open" | "close" }) => void,
  ): Promise<() => void>;
}

export interface SessionStore {
  get(id: string): SessionState | undefined;
  upsert(state: SessionState): void;
}

export function createSessionStore(): SessionStore {
  const sessions = new Map<string, SessionState>();

  return {
    get(id) {
      return sessions.get(id);
    },
    upsert(state) {
      sessions.set(state.id, state);
    },
  };
}

export function createEmptyRuntimeSnapshot(): RuntimeSnapshot {
  return {
    files: [],
    openPorts: [],
    activeCommands: [],
  };
}

export function createSessionState(input: Pick<SessionState, "id" | "projectId">): SessionState {
  const timestamp = new Date().toISOString();

  return {
    id: input.id,
    projectId: input.projectId,
    messages: [],
    plan: [],
    actions: [],
    runtime: createEmptyRuntimeSnapshot(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createTimelineAction(input: {
  source: ActionState["source"];
  action: AgentAction;
}): ActionState {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    source: input.source,
    action: input.action,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface Executor {
  enqueue(action: ActionState): Promise<ActionState>;
}

export function createExecutor(input: {
  runtime: RuntimeAdapter;
  sessionStore: SessionStore;
}): Executor {
  return {
    async enqueue(action) {
      const timestamp = new Date().toISOString();

      if (action.action.type === "file.write") {
        await input.runtime.writeFile(action.action.path, action.action.content);
      }

      if (action.action.type === "file.patch") {
        await input.runtime.patchFile(action.action.path, action.action.patch);
      }

      if (action.action.type === "command.run") {
        await input.runtime.runCommand(action.action.command, {
          cwd: action.action.cwd,
        });
      }

      return {
        ...action,
        status: "completed",
        updatedAt: timestamp,
      };
    },
  };
}
