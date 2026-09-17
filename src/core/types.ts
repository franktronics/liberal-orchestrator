/** Harnesses supported by lior. */
export type Harness = "opencode" | "codex";

/**
 * Canonical reasoning-effort vocabulary (superset of both harnesses;
 * adapters map or drop per-model unsupported values with a warning).
 */
export type Effort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** Wire protocol a provider endpoint speaks (matters for Codex: Responses only). */
export type WireApi = "responses" | "chat" | "anthropic";

/** Alias entry under `models:` in lior.yaml. */
export interface ModelSpec {
  provider: string;
  id: string;
  /** Optional display metadata for private models or overrides. */
  name?: string;
  context?: number;
  output?: number;
  reasoning?: boolean;
  tool_call?: boolean;
  released?: string;
  cost?: { input?: number; output?: number };
}

/** Endpoint metadata under `providers:` in lior.yaml (never secrets). */
export interface ProviderSpec {
  base_url?: string;
  env?: string;
  wire_api?: WireApi;
}

/** A resolved model reference: provider + model id + optional effort. */
export interface ModelRef {
  provider: string;
  model: string;
  effort?: Effort;
}

/** Role binding: default model plus optional per-harness overrides. */
export interface RoleBinding {
  model: string;
  opencode?: string;
  codex?: string;
}

/** Parsed lior.yaml. */
export interface LiorConfig {
  version: number;
  harness?: Harness[];
  models?: Record<string, ModelSpec>;
  bindings?: Record<string, string | RoleBinding>;
  providers?: Record<string, ProviderSpec>;
  presets?: Record<string, Record<string, string>>;
}
