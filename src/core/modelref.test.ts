import { describe, expect, test } from "bun:test";
import { ModelRefError } from "./errors";
import { formatModelRef, parseModelRef } from "./modelref";
import type { LiorConfig } from "./types";

const config: LiorConfig = {
  version: 1,
  models: {
    astra: { provider: "openai", id: "gpt-6-astra" },
    glm: { provider: "zhipuai", id: "glm-5.3" },
  },
};

describe("parseModelRef", () => {
  test("parses provider/model", () => {
    expect(parseModelRef("zhipuai/glm-5.3")).toEqual({ provider: "zhipuai", model: "glm-5.3" });
  });

  test("parses effort suffix", () => {
    expect(parseModelRef("openai/gpt-6-astra#high")).toEqual({
      provider: "openai",
      model: "gpt-6-astra",
      effort: "high",
    });
  });

  test("splits on the first slash only (model ids may contain slashes)", () => {
    expect(parseModelRef("tokengo/qwen/qwen3.5-397b-a17b#low")).toEqual({
      provider: "tokengo",
      model: "qwen/qwen3.5-397b-a17b",
      effort: "low",
    });
  });

  test("resolves aliases through the config", () => {
    expect(parseModelRef("astra#max", config)).toEqual({
      provider: "openai",
      model: "gpt-6-astra",
      effort: "max",
    });
    expect(parseModelRef("glm", config)).toEqual({
      provider: "zhipuai",
      model: "glm-5.3",
    });
  });

  test("rejects unknown aliases", () => {
    expect(() => parseModelRef("nope", config)).toThrow(ModelRefError);
    expect(() => parseModelRef("nope")).toThrow(/unknown model alias/);
  });

  test("rejects invalid effort values", () => {
    expect(() => parseModelRef("openai/gpt-6-astra#turbo")).toThrow(/invalid effort/);
  });

  test("rejects empty references", () => {
    expect(() => parseModelRef("   ")).toThrow(/empty/);
    expect(() => parseModelRef("/glm")).toThrow(/invalid model reference/);
  });
});

describe("formatModelRef", () => {
  test("round-trips with parseModelRef", () => {
    for (const spec of ["zhipuai/glm-5.3", "openai/gpt-6-astra#high", "tokengo/qwen/x"]) {
      expect(formatModelRef(parseModelRef(spec))).toBe(spec);
    }
  });
});
