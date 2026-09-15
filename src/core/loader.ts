import { readTextFile } from "../util/io";
import { ConfigError } from "./errors";
import { parseConfig, validateConfig } from "./schema";
import type { LiorConfig } from "./types";

export interface LoadOptions {
  /** Path to the project-level lior.yaml (highest precedence). */
  projectPath?: string;
  /** Path to the global user lior.yaml (lowest precedence). */
  globalPath?: string;
}

export interface LoadResult {
  /** Merged and validated configuration (global < project). */
  config: LiorConfig;
  /** Files that actually existed and were loaded. */
  sources: string[];
}

/**
 * Loads and merges global + project lior.yaml files.
 * Records (models, bindings, providers, presets) merge key by key with the
 * project layer winning; scalars and arrays are replaced wholesale.
 */
export async function loadConfig(opts: LoadOptions = {}): Promise<LoadResult> {
  const configs: LiorConfig[] = [];
  const sources: string[] = [];

  for (const path of [opts.globalPath, opts.projectPath]) {
    if (!path) {
      continue;
    }
    const text = await readTextFile(path);
    if (text === null) {
      continue;
    }
    configs.push(parseConfig(text, path));
    sources.push(path);
  }

  const merged = mergeConfigs(configs);
  // Re-validate the merged object: catches cross-layer inconsistencies early.
  const config = validateConfig(merged, sources.length > 1 ? "merged config" : "lior.yaml");
  return { config, sources };
}

/** Merges config layers; later layers win (records merge key by key). */
export function mergeConfigs(layers: LiorConfig[]): LiorConfig {
  const merged: LiorConfig = { version: 1 };
  for (const layer of layers) {
    merged.version = layer.version;
    if (layer.harness !== undefined) {
      merged.harness = layer.harness;
    }
    merged.models = mergeRecords(merged.models, layer.models);
    merged.bindings = mergeRecords(merged.bindings, layer.bindings);
    merged.providers = mergeRecords(merged.providers, layer.providers);
    merged.presets = mergeRecords(merged.presets, layer.presets);
  }
  return merged;
}

function mergeRecords<T>(
  base: Record<string, T> | undefined,
  override: Record<string, T> | undefined,
): Record<string, T> | undefined {
  if (base === undefined) {
    return override;
  }
  if (override === undefined) {
    return base;
  }
  return { ...base, ...override };
}

// Re-exported for callers that only need the error type.
export { ConfigError };
