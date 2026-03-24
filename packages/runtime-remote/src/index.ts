import { type RuntimeAdapter } from "@ezu/core";

export interface RemoteRuntimeConfig {
  baseUrl: string;
  projectId: string;
}

export class RemoteRuntimeStub {
  constructor(readonly config: RemoteRuntimeConfig) {}
}

export function createRemoteRuntimeStub(config: RemoteRuntimeConfig): RuntimeAdapter {
  throw new Error(`Remote runtime not implemented for ${config.baseUrl}`);
}
