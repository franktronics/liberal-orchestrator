import { describe, expect, test } from "bun:test";
import type { LiorConfig } from "../core/types";
import { aliasMap, searchModels } from "./search";
import type { Registry } from "./types";

const registry: Registry = {
  "zhipuai/glm-5.3": {
    provider: "zhipuai",
    id: "glm-5.3",
    name: "GLM-5.3",
    context: 1000000,
    output: 131072,
    reasoning: true,
    toolCall: true,
    released: "2026-08-14",
  },
  "openai/gpt-6-astra": {
    provider: "openai",
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    context: 1050000,
    output: 128000,
    released: "2026-09-04",
  },
  "openai/gpt-5.6-luna": {
    provider: "openai",
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    context: 1050000,
    output: 128000,
    released: "2026-07-09",
  },
};

const config: LiorConfig = {
  version: 1,
  models: {
    astra: { provider: "openai", id: "gpt-6-astra" },
  },
};

describe("searchModels", () => {
  test("matches provider/model keys and names, case-insensitively", () => {
    const keys = searchModels(registry, "GLM").map((hit) => hit.key);
    expect(keys).toEqual(["zhipuai/glm-5.3"]);
    expect(searchModels(registry, "astra").map((h) => h.key)).toEqual(["openai/gpt-6-astra"]);
  });

  test("an empty term returns the most recently released models", () => {
    expect(searchModels(registry, "").map((h) => h.key)).toEqual([
      "openai/gpt-6-astra",
      "zhipuai/glm-5.3",
      "openai/gpt-5.6-luna",
    ]);
  });

  test("aliases match and are surfaced on the hit", () => {
    const hits = searchModels(registry, "astra", { aliases: aliasMap(config) });
    expect(hits.map((h) => h.alias)).toContain("astra");
  });

  test("respects the limit", () => {
    expect(searchModels(registry, "", { limit: 1 })).toHaveLength(1);
  });

  test("alias hits rank first, beyond the recency order", () => {
    const aliases = { luna: "openai/gpt-5.6-luna" };
    const hits = searchModels(registry, "luna", { aliases, limit: 1 });
    expect(hits[0]?.key).toBe("openai/gpt-5.6-luna");
    expect(hits[0]?.alias).toBe("luna");
  });
});

describe("aliasMap", () => {
  test("maps aliases to registry keys", () => {
    expect(aliasMap(config)).toEqual({ astra: "openai/gpt-6-astra" });
    expect(aliasMap(undefined)).toEqual({});
  });
});
