import { type RuntimeAdapter, type RuntimeProcess } from "@ezu/core";
import { type RuntimePort } from "@ezu/protocol";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createPreviewUrl(html: string): string {
  if (typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function renderRuntimePreviewDocument(input: {
  files: Array<{ path: string; content: string }>;
  port: number;
}): string {
  const latestFile = input.files.at(-1);
  const latestContent = latestFile?.content ?? "No file content has been written into the browser container yet.";
  const clubNames = [...latestContent.matchAll(/name:\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name))
    .slice(0, 4);
  const previewCards =
    clubNames.length > 0
      ? clubNames
          .map(
            (name, index) => `
              <article class="preview-card">
                <span class="badge">0${String(index + 1)}</span>
                <strong>${escapeHtml(name)}</strong>
                <p>Generated from the current virtual file system payload.</p>
              </article>
            `,
          )
          .join("")
      : `
        <article class="preview-card">
          <span class="badge">01</span>
          <strong>Runtime Preview</strong>
          <p>Write or patch a file and the preview surface updates immediately.</p>
        </article>
      `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Browser Runtime Preview</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0c0f14;
        --panel: rgba(19, 23, 30, 0.94);
        --panel-soft: rgba(25, 30, 40, 0.96);
        --ink: #eef2ff;
        --muted: #9aa4b2;
        --line: rgba(255, 255, 255, 0.08);
        --accent: #4f8cff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(79, 140, 255, 0.16), transparent 24%),
          linear-gradient(180deg, #0a0d12 0%, var(--bg) 100%);
      }

      main {
        width: min(1120px, calc(100% - 32px));
        margin: 24px auto;
        display: grid;
        gap: 18px;
      }

      section {
        padding: 18px;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: var(--panel);
      }

      h1, h2, h3, p, pre {
        margin: 0;
      }

      .hero {
        display: grid;
        gap: 14px;
      }

      .eyebrow {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--accent);
        font-weight: 700;
      }

      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      }

      .list {
        display: grid;
        gap: 10px;
        padding: 0;
        list-style: none;
      }

      .list li {
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: var(--panel-soft);
        color: var(--muted);
      }

      pre {
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #0f1319;
        font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
        font-size: 13px;
        line-height: 1.55;
      }

      .viewport {
        display: grid;
        gap: 12px;
      }

      .browser-shell {
        display: grid;
        gap: 12px;
      }

      .browser-bar {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .browser-dots {
        display: flex;
        gap: 8px;
      }

      .browser-dots span {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #5f6b7b;
      }

      .browser-url {
        flex: 1;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel-soft);
        color: var(--muted);
        font-size: 13px;
      }

      .viewport-frame {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, #151b24, #10141b);
      }

      .preview-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 14px;
      }

      .preview-card {
        padding: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.03);
      }

      .preview-card strong,
      .preview-card p,
      .badge {
        display: block;
      }

      .preview-card p {
        margin-top: 8px;
        color: var(--muted);
      }

      .badge {
        margin-bottom: 8px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .preview-stage {
        min-height: 220px;
        margin-top: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background:
          radial-gradient(circle at top left, rgba(79, 140, 255, 0.18), transparent 25%),
          linear-gradient(180deg, #ffffff 0%, #eef2f8 100%);
        color: #111827;
        padding: 20px;
      }

      .preview-stage h3,
      .preview-stage p {
        margin: 0;
      }

      .preview-stage p {
        margin-top: 10px;
        color: #4b5563;
      }

      @media (max-width: 720px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .preview-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">Browser Container</p>
        <h1>Live preview on port ${escapeHtml(String(input.port))}</h1>
        <p>This preview is generated inside the in-browser runtime from the virtual file system state.</p>
      </section>
      <div class="grid">
        <section>
          <p class="eyebrow">Files</p>
          <h2>Runtime file system</h2>
          <ul class="list">
            ${
              input.files.length > 0
                ? input.files
                    .map((file) => `<li>${escapeHtml(file.path)}</li>`)
                    .join("")
                : "<li>No files in the runtime yet</li>"
            }
          </ul>
        </section>
        <section class="viewport">
          <div>
            <p class="eyebrow">Surface</p>
            <h2>Rendered payload</h2>
          </div>
          <div class="browser-shell">
            <div class="browser-bar">
              <div class="browser-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="browser-url">browser-runtime://preview:${escapeHtml(String(input.port))}</div>
            </div>
            <div class="viewport-frame">
              <h3>${escapeHtml(latestFile?.path ?? "No active file")}</h3>
              <p>${escapeHtml(
                latestFile
                  ? "Latest runtime artifact mirrored into the preview surface."
                  : "Once an action writes or patches a file, its content appears here.",
              )}</p>
              <div class="preview-grid">
                ${previewCards}
              </div>
              <div class="preview-stage">
                <p class="eyebrow">App Preview</p>
                <h3>${escapeHtml(clubNames[0] ?? "Interactive browser preview")}</h3>
                <p>
                  This pane is generated from the virtual file system state, giving the session a fast
                  embedded preview without leaving the workbench.
                </p>
              </div>
            </div>
          </div>
          <pre>${escapeHtml(latestContent)}</pre>
        </section>
      </div>
    </main>
  </body>
</html>`;
}

class BrowserRuntimeProcess implements RuntimeProcess {
  readonly id = crypto.randomUUID();
  private readonly outputListeners = new Set<(chunk: string) => void>();
  private readonly exitListeners = new Set<(code: number) => void>();
  private closed = false;

  emitOutput(chunk: string): void {
    if (this.closed) {
      return;
    }

    for (const listener of this.outputListeners) {
      listener(chunk);
    }
  }

  emitExit(code: number): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    for (const listener of this.exitListeners) {
      listener(code);
    }
  }

  async kill(): Promise<void> {
    this.emitExit(0);
  }

  onOutput(cb: (chunk: string) => void): void {
    this.outputListeners.add(cb);
  }

  onExit(cb: (code: number) => void): void {
    this.exitListeners.add(cb);
  }
}

export class BrowserRuntimeStub implements RuntimeAdapter {
  private readonly files = new Map<string, string>();
  private readonly fileWatchers = new Set<(event: { path: string; type: string }) => void>();
  private readonly portWatchers = new Set<
    (event: { port: number; url: string; status: "open" | "close" }) => void
  >();
  private readonly openPorts = new Map<number, string>();

  async readFile(path: string): Promise<string> {
    return this.files.get(path) ?? "";
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    this.emitFileEvent({ path, type: "write" });
    this.refreshOpenPreviews();
  }

  async patchFile(path: string, patch: string): Promise<void> {
    const current = this.files.get(path) ?? "";
    this.files.set(path, `${current}\n${patch}`.trim());
    this.emitFileEvent({ path, type: "patch" });
    this.refreshOpenPreviews();
  }

  async listFiles(root: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(root)).sort();
  }

  async runCommand(command: string, opts?: { cwd?: string }): Promise<RuntimeProcess> {
    const process = new BrowserRuntimeProcess();

    queueMicrotask(() => {
      process.emitOutput(`$ ${command}\n`);

      if (opts?.cwd) {
        process.emitOutput(`cwd: ${opts.cwd}\n`);
      }

      if (/(dev|serve|preview|start)/i.test(command)) {
        void this.openPreview(4173).then((port) => {
          process.emitOutput(`preview ready: ${port.url}\n`);
          process.emitExit(0);
        });
        return;
      }

      process.emitOutput("command completed inside the browser runtime\n");
      process.emitExit(0);
    });

    return process;
  }

  async openPreview(port = 4173): Promise<RuntimePort> {
    const currentUrl = this.openPorts.get(port);

    if (currentUrl && currentUrl.startsWith("blob:")) {
      URL.revokeObjectURL(currentUrl);
    }

    const nextUrl = createPreviewUrl(
      renderRuntimePreviewDocument({
        files: [...this.files.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, content]) => ({ path, content })),
        port,
      }),
    );

    this.openPorts.set(port, nextUrl);
    this.emitPortEvent({ port, url: nextUrl, status: "open" });

    return {
      port,
      url: nextUrl,
      status: "open",
    };
  }

  async watchFiles(cb: (event: { path: string; type: string }) => void): Promise<() => void> {
    this.fileWatchers.add(cb);
    return () => {
      this.fileWatchers.delete(cb);
    };
  }

  async watchPorts(
    cb: (event: { port: number; url: string; status: "open" | "close" }) => void,
  ): Promise<() => void> {
    this.portWatchers.add(cb);

    for (const [port, url] of this.openPorts.entries()) {
      cb({ port, url, status: "open" });
    }

    return () => {
      this.portWatchers.delete(cb);
    };
  }

  private emitFileEvent(event: { path: string; type: string }): void {
    for (const listener of this.fileWatchers) {
      listener(event);
    }
  }

  private emitPortEvent(event: { port: number; url: string; status: "open" | "close" }): void {
    for (const listener of this.portWatchers) {
      listener(event);
    }
  }

  private refreshOpenPreviews(): void {
    for (const port of this.openPorts.keys()) {
      void this.openPreview(port);
    }
  }
}

export function createBrowserRuntimeStub(): RuntimeAdapter {
  return new BrowserRuntimeStub();
}
