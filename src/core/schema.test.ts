import { describe, expect, test } from "bun:test";
import { ConfigError } from "./errors";
import { parseConfig } from "./schema";

const FULL = `
version: 1
harness: [opencode, codex]
models:
  astra:
    provider: openai
    id: gpt-6-astra
    name: GPT-6 Astra Custom
    context: 1050000
    tool_call: true
    released: 2026-09-04
    cost: { input: 1.5, output: 9 }
bindings:
  orchestrator: astra#high
  reviewer:
    model: glm
    codex: openai/astra
providers:
  zhipuai:
    base_url: https://api.z.ai/api/paas/v4
    env: ZAI_API_KEY
    wire_api: chat
presets:
  budget: { orchestrator: glm }
`;

describe("parseConfig", () => {
  test("accepts an empty document with defaults", () => {
    const config = parseConfig("");
    expect(config.version).toBe(1);
    expect(config.bindings).toBeUndefined();
  });

  test("parses the full example", () => {
    const config = parseConfig(FULL);
    expect(config.harness).toEqual(["opencode", "codex"]);
    expect(config.models?.astra).toEqual({
      provider: "openai",
      id: "gpt-6-astra",
      name: "GPT-6 Astra Custom",
      context: 1050000,
      tool_call: true,
      released: "2026-09-04",
      cost: { input: 1.5, output: 9 },
    });
    expect(config.bindings?.reviewer).toEqual({
      model: "glm",
      codex: "openai/astra",
    });
    expect(config.providers?.zhipuai?.wire_api).toBe("chat");
  });

  test("rejects unknown harnesses", () => {
    expect(() => parseConfig("harness: [vscode]")).toThrow(/harness/);
  });

  test("rejects invalid versions", () => {
    expect(() => parseConfig("version: 2")).toThrow(/version/);
  });

  test("rejects invalid YAML with a syntax error", () => {
    expect(() => parseConfig("version: [1")).toThrow(ConfigError);
  });

  test("labels errors with the source", () => {
    try {
      parseConfig("version: 2", "global.yaml");
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toMatch(/^global\.yaml:/);
    }
  });
});
