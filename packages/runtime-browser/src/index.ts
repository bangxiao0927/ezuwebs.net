import { type RuntimeAdapter, type RuntimeProcess } from "@ezu/core";

class BrowserRuntimeProcess implements RuntimeProcess {
  readonly id = crypto.randomUUID();

  async kill(): Promise<void> {}

  onOutput(_cb: (chunk: string) => void): void {}

  onExit(_cb: (code: number) => void): void {}
}

export class BrowserRuntimeStub implements RuntimeAdapter {
  private readonly files = new Map<string, string>();

  async readFile(path: string): Promise<string> {
    return this.files.get(path) ?? "";
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async patchFile(path: string, patch: string): Promise<void> {
    const current = this.files.get(path) ?? "";
    this.files.set(path, `${current}\n${patch}`.trim());
  }

  async listFiles(root: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(root));
  }

  async runCommand(_command: string, _opts?: { cwd?: string }): Promise<RuntimeProcess> {
    return new BrowserRuntimeProcess();
  }

  async watchFiles(_cb: (event: { path: string; type: string }) => void): Promise<() => void> {
    return () => {};
  }

  async watchPorts(
    _cb: (event: { port: number; url: string; status: "open" | "close" }) => void,
  ): Promise<() => void> {
    return () => {};
  }
}

export function createBrowserRuntimeStub(): RuntimeAdapter {
  return new BrowserRuntimeStub();
}
