import type { LiorConfig } from "../core/types";
import type { Registry, RegistryModel } from "./types";

export interface SearchHit {
  /** Registry key: `${provider}/${modelId}`. */
  key: string;
  model: RegistryModel;
  /** Short name from lior.yaml `models:` when matched. */
  alias?: string;
}

export interface SearchOptions {
  limit?: number;
  /** alias → registry key, from lior.yaml `models:`. */
  aliases?: Record<string, string>;
}

/** Builds the alias → registry-key map from a lior config. */
export function aliasMap(config?: LiorConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [alias, spec] of Object.entries(config?.models ?? {})) {
    map[alias] = `${spec.provider}/${spec.id}`;
  }
  return map;
}

/**
 * Case-insensitive substring search over `provider/model` keys and display
 * names. An empty term returns the most recently released models.
 * Aliases from lior.yaml also match and are surfaced on the hit.
 */
export function searchModels(
  registry: Registry,
  term: string,
  opts: SearchOptions = {},
): SearchHit[] {
  const limit = opts.limit ?? 20;
  const needle = term.trim().toLowerCase();

  // Reverse map so direct key matches surface their alias too.
  const aliasBykey: Record<string, string> = {};
  for (const [alias, key] of Object.entries(opts.aliases ?? {})) {
    aliasBykey[key] ??= alias;
  }

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const [key, model] of Object.entries(registry)) {
    if (!needle || `${key} ${model.name}`.toLowerCase().includes(needle)) {
      hits.push({ key, model, alias: aliasBykey[key] });
      seen.add(key);
    }
  }
  if (needle && opts.aliases) {
    for (const [alias, key] of Object.entries(opts.aliases)) {
      if (!alias.toLowerCase().includes(needle) || seen.has(key)) {
        continue;
      }
      const model = registry[key];
      if (model) {
        hits.push({ key, model, alias });
        seen.add(key);
      }
    }
  }

  // Explicit alias matches come first (clearest user intent), then recency.
  return hits.sort(byRank).slice(0, limit);
}

function byRank(a: SearchHit, b: SearchHit): number {
  if ((a.alias !== undefined) !== (b.alias !== undefined)) {
    return a.alias !== undefined ? -1 : 1;
  }
  return byReleasedDesc(a, b);
}

function byReleasedDesc(a: SearchHit, b: SearchHit): number {
  const ra = a.model.released ?? "";
  const rb = b.model.released ?? "";
  if (ra !== rb) {
    return ra < rb ? 1 : -1;
  }
  return a.key.localeCompare(b.key);
}
