import { createDemoDocument } from "./demo";

export function mountDemoApp(target: HTMLElement = document.body): void {
  target.innerHTML = createDemoDocument();
}

if (typeof document !== "undefined") {
  mountDemoApp();
}
