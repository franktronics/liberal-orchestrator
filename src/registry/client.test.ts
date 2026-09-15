import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJsonFile, writeJsonFileAtomic } from "../util/io";
import { bundledSnapshot, getRegistry } from "./client";
import type { FetchLike } from "./client";
import type { RegistryCacheFile } from "./types";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "lior-registry-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const RAW_FIXTURE = {
  example: {
    models: {
      "mini/x": {
        name: "Mini X",
        limit: { context: 8192, output: 1024 },
        release_date: "2026-01-01",
      },
    },
  },
};

const fetchOk: FetchLike = async () =>
  new Response(JSON.stringify(RAW_FIXTURE), { headers: { "content-type": "application/json" } });

const fetchFails: FetchLike = async () => {
  throw new Error("network down");
};

describe("getRegistry", () => {
  test("uses a fresh cache without touching the network", async () => {
    const cachePath = join(dir, "fresh.json");
    const now = Date.parse("2026-09-15T10:00:00Z");
    const cache: RegistryCacheFile = {
      fetchedAt: new Date(now - 1000).toISOString(),
      models: { "cached/model": { provider: "cached", id: "model", name: "Cached" } },
    };
    writeJsonFileAtomic(cachePath, cache);

    const result = await getRegistry({ cachePath, now, fetchImpl: fetchFails });
    expect(result.source).toBe("cache");
    expect(Object.keys(result.registry)).toEqual(["cached/model"]);
  });

  test("refreshes a stale cache from the network and rewrites it", async () => {
    const cachePath = join(dir, "stale.json");
    const now = Date.parse("2026-09-15T10:00:00Z");
    writeJsonFileAtomic(cachePath, {
      fetchedAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      models: {},
    } satisfies RegistryCacheFile);

    const result = await getRegistry({ cachePath, now, fetchImpl: fetchOk });
    expect(result.source).toBe("network");
    expect(Object.keys(result.registry)).toEqual(["example/mini/x"]);

    const rewritten = readJsonFile<RegistryCacheFile>(cachePath);
    expect(Object.keys(rewritten?.models ?? {})).toEqual(["example/mini/x"]);
  });

  test("falls back to the bundled snapshot when the network fails", async () => {
    const result = await getRegistry({
      cachePath: join(dir, "missing.json"),
      fetchImpl: fetchFails,
    });
    expect(result.source).toBe("snapshot");
    expect(result.warning).toMatch(/using bundled snapshot/);
    expect(Object.keys(result.registry).length).toBeGreaterThan(0);
  });

  test("never hits the network when allowNetwork is false", async () => {
    const result = await getRegistry({
      cachePath: join(dir, "missing2.json"),
      allowNetwork: false,
      fetchImpl: fetchOk,
    });
    expect(result.source).toBe("snapshot");
  });

  test("bundled snapshot contains the flagship models", () => {
    const snapshot = bundledSnapshot();
    expect(snapshot["zhipuai/glm-5.3"]).toBeDefined();
    expect(snapshot["openai/gpt-6-astra"]).toBeDefined();
  });
});
