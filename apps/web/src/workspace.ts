/// <reference types="vite/client" />

export interface WorkspaceFileEntry {
  path: string;
  content: string;
}

export interface WorkspaceSnapshot {
  rootPath: string;
  files: WorkspaceFileEntry[];
}

const workspaceRoot = ".";

const workspaceModules = import.meta.glob(
  [
    "../../../README.md",
    "../../../package.json",
    "../../../pnpm-workspace.yaml",
    "../../../tsconfig.json",
    "../../../tsconfig.base.json",
    "../../../apps/agent/package.json",
    "../../../apps/agent/src/*.ts",
    "../../../apps/web/package.json",
    "../../../apps/web/src/*.ts",
    "../../../packages/*/package.json",
    "../../../packages/*/src/*.ts",
  ],
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
) as Record<string, string>;

function normalizeWorkspacePath(path: string): string {
  return path.replace(/^\.\.\/\.\.\/\.\.\//, "");
}

export function getDefaultWorkspaceSnapshot(): WorkspaceSnapshot {
  const files = Object.entries(workspaceModules)
    .map(([path, content]) => ({
      path: normalizeWorkspacePath(path),
      content,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    rootPath: workspaceRoot,
    files,
  };
}
