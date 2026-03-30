import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@ezu/agent": fileURLToPath(new URL("../agent/src/index.ts", import.meta.url)),
      "@ezu/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@ezu/model-gateway": fileURLToPath(
        new URL("../../packages/model-gateway/src/index.ts", import.meta.url),
      ),
      "@ezu/protocol": fileURLToPath(new URL("../../packages/protocol/src/index.ts", import.meta.url)),
      "@ezu/runtime-browser": fileURLToPath(
        new URL("../../packages/runtime-browser/src/index.ts", import.meta.url),
      ),
      "@ezu/runtime-remote": fileURLToPath(
        new URL("../../packages/runtime-remote/src/index.ts", import.meta.url),
      ),
      "@ezu/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
    },
  },
  server: {
    allowedHosts: ["ezuwebs.com", "www.ezuwebs.com"],
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  preview: {
    allowedHosts: ["ezuwebs.com", "www.ezuwebs.com"],
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
