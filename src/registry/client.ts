import { readJsonFile, writeJsonFileAtomic } from "../util/io";
import { normalizeApiJson } from "./normalize";
import snapshot from "./snapshot.json";
import type { Registry, RegistryCacheFile } from "./types";

export const MODELS_DEV_URL = "https://models.dev/api.json";
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimal fetch shape lior needs (injection point for tests). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GetRegistryOptions {
  /** Registry cache file. When omitted, no cache is read or written. */
  cachePath?: string;
  /** Cache freshness window. Default 24h. */
  ttlMs?: number;
  /** Clock injection for tests. */
  now?: number;
  /** Fetch implementation injection for tests. */
  fetchImpl?: FetchLike;
  /** Set false to skip the network entirely. Default true. */
  allowNetwork?: boolean;
}

export interface GetRegistryResult {
  registry: Registry;
  source: "cache" | "network" | "snapshot";
  fetchedAt?: number;
  /** Present when the network failed and we fell back to the snapshot. */
  warning?: string;
}

/** The registry snapshot bundled with the package (offline-first). */
export function bundledSnapshot(): Registry {
  return snapshot as unknown as Registry;
}

/**
 * Returns the freshest registry available, never throwing:
 * fresh cache → network (then cached) → bundled snapshot.
 */
export async function getRegistry(opts: GetRegistryOptions = {}): Promise<GetRegistryResult> {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = opts.now ?? Date.now();
  let cacheWarning: string | undefined;

  if (opts.cachePath) {
    const cacheResult = readCache(opts.cachePath);
    const cached = cacheResult.cache;
    cacheWarning = cacheResult.warning;
    if (cached?.models && cached.fetchedAt) {
      const fetchedAt = Date.parse(cached.fetchedAt);
      if (!Number.isNaN(fetchedAt) && now - fetchedAt < ttlMs) {
        return { registry: cached.models, source: "cache", fetchedAt, warning: cacheWarning };
      }
    }
  }

  if (opts.allowNetwork !== false) {
    try {
      const res = await (opts.fetchImpl ?? fetch)(MODELS_DEV_URL, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const raw: unknown = await res.json();
      const registry = normalizeApiJson(raw);
      if (Object.keys(registry).length === 0) {
        throw new Error("empty registry payload");
      }
      if (opts.cachePath) {
        const cacheFile: RegistryCacheFile = {
          fetchedAt: new Date(now).toISOString(),
          models: registry,
        };
        writeJsonFileAtomic(opts.cachePath, cacheFile);
      }
      return { registry, source: "network", fetchedAt: now, warning: cacheWarning };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const networkWarning = `could not refresh registry (${reason}) — using bundled snapshot`;
      return {
        registry: bundledSnapshot(),
        source: "snapshot",
        warning: cacheWarning ? `${cacheWarning}; ${networkWarning}` : networkWarning,
      };
    }
  }

  return { registry: bundledSnapshot(), source: "snapshot", warning: cacheWarning };
}

function readCache(path: string): { cache: RegistryCacheFile | null; warning?: string } {
  let value: unknown;
  try {
    value = readJsonFile<unknown>(path);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { cache: null, warning: `ignoring invalid registry cache (${reason})` };
  }

  if (value === null) {
    return { cache: null };
  }
  if (!isRegistryCacheFile(value)) {
    return { cache: null, warning: "ignoring invalid registry cache (unexpected shape)" };
  }
  return { cache: value };
}

function isRegistryCacheFile(value: unknown): value is RegistryCacheFile {
  if (!isRecord(value) || typeof value.fetchedAt !== "string" || !isRecord(value.models)) {
    return false;
  }
  return Object.values(value.models).every(
    (model) =>
      isRecord(model) &&
      typeof model.provider === "string" &&
      typeof model.id === "string" &&
      typeof model.name === "string",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
