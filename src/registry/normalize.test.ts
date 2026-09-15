import { describe, expect, test } from "bun:test";
import { normalizeApiJson } from "./normalize";

const RAW = {
  tokengo: {
    name: "TokenGo",
    models: {
      // model id containing a slash (real models.dev pattern)
      "qwen/qwen3.5-397b-a17b": {
        name: "Qwen3.5 397B-A17B",
        limit: { context: 262144, output: 65536 },
        cost: { input: 0.4, output: 2.65 },
        reasoning: true,
        tool_call: true,
        release_date: "2026-02-15",
      },
      "minimax/minimax-m2.5": {
        name: "MiniMax-M2.5",
        limit: { context: 204800, output: 131072 },
        release_date: "2026-02-12",
      },
    },
  },
  "image-only": {
    name: "ImageOnly",
    models: {
      "image-01": { name: "Image 01", limit: { context: 0 }, release_date: "2025-02-15" },
    },
  },
  "no-models": { name: "Empty" },
};

describe("normalizeApiJson", () => {
  const registry = normalizeApiJson(RAW);

  test("keys models as provider/modelId, preserving slashes in ids", () => {
    expect(Object.keys(registry).sort()).toEqual([
      "tokengo/minimax/minimax-m2.5",
      "tokengo/qwen/qwen3.5-397b-a17b",
    ]);
  });

  test("normalizes fields", () => {
    const model = registry["tokengo/qwen/qwen3.5-397b-a17b"];
    expect(model?.provider).toBe("tokengo");
    expect(model?.id).toBe("qwen/qwen3.5-397b-a17b");
    expect(model?.name).toBe("Qwen3.5 397B-A17B");
    expect(model?.context).toBe(262144);
    expect(model?.output).toBe(65536);
    expect(model?.cost).toEqual({ input: 0.4, output: 2.65 });
    expect(model?.reasoning).toBe(true);
    expect(model?.toolCall).toBe(true);
    expect(model?.released).toBe("2026-02-15");
  });

  test("skips models without a context window and providers without models", () => {
    expect(registry["image-only/image-01"]).toBeUndefined();
    expect(Object.keys(registry).some((key) => key.startsWith("no-models/"))).toBe(false);
  });

  test("omits cost when absent", () => {
    expect(registry["tokengo/minimax/minimax-m2.5"]?.cost).toBeUndefined();
  });

  test("handles garbage input gracefully", () => {
    expect(normalizeApiJson(null)).toEqual({});
    expect(normalizeApiJson("nope")).toEqual({});
    expect(normalizeApiJson({ weird: true })).toEqual({});
  });
});
