export type WorkspacePanel =
  | "ChatPanel"
  | "PlanPanel"
  | "InteractionPanel"
  | "ActionTimeline"
  | "FileTree"
  | "EditorPanel"
  | "TerminalPanel"
  | "PreviewPanel"
  | "DiffPanel";

export const centerWorkspacePanels: WorkspacePanel[] = [
  "ChatPanel",
  "PlanPanel",
  "InteractionPanel",
  "ActionTimeline",
];

export const rightWorkbenchPanels: WorkspacePanel[] = [
  "FileTree",
  "EditorPanel",
  "TerminalPanel",
  "PreviewPanel",
  "DiffPanel",
];
