import { ModelRefError } from "./errors";
import type { Effort, LiorConfig, ModelRef } from "./types";

const EFFORTS = new Set<string>(["minimal", "low", "medium", "high", "xhigh", "max"]);

function splitOnce(value: string, sep: string): [string, string | undefined] {
  const idx = value.indexOf(sep);
  if (idx === -1) {
    return [value, undefined];
  }
  return [value.slice(0, idx), value.slice(idx + sep.length)];
}

/**
 * Parses `provider/model#effort`.
 *
 * Model ids may themselves contain slashes (e.g. `tokengo/qwen/qwen3.5`),
 * so only the FIRST segment is the provider. A single token without `/` is
 * an alias and must be defined under `models:` in the config.
 */
export function parseModelRef(spec: string, config?: LiorConfig): ModelRef {
  const raw = spec.trim();
  if (!raw) {
    throw new ModelRefError("empty model reference");
  }

  const [body, effort] = splitOnce(raw, "#");
  if (effort !== undefined && !EFFORTS.has(effort)) {
    throw new ModelRefError(
      `invalid effort "#${effort}" in "${spec}" — expected one of: ${[...EFFORTS].join(", ")}`,
    );
  }

  if (body.includes("/")) {
    const [provider, model] = splitOnce(body, "/");
    if (!provider || !model) {
      throw new ModelRefError(`invalid model reference "${spec}" — expected provider/model`);
    }
    return withEffort({ provider, model }, effort);
  }

  const alias = config?.models?.[body];
  if (!alias) {
    throw new ModelRefError(`unknown model alias "${body}" — define it under models: in lior.yaml`);
  }
  return withEffort({ provider: alias.provider, model: alias.id }, effort);
}

function withEffort(ref: ModelRef, effort: string | undefined): ModelRef {
  if (effort === undefined) {
    return ref;
  }
  return { ...ref, effort: effort as Effort };
}

/** Inverse of parseModelRef: `provider/model#effort`. */
export function formatModelRef(ref: ModelRef): string {
  const effort = ref.effort ? `#${ref.effort}` : "";
  return `${ref.provider}/${ref.model}${effort}`;
}
