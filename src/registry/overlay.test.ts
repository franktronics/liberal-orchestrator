import { describe, expect, test } from "bun:test";
import type { LiorConfig } from "../core/types";
import { applyRegistryOverlay } from "./overlay";
import type { Registry } from "./types";

const registry: Registry = {
  "openai/existing": {
    provider: "openai",
    id: "existing",
    name: "Existing model",
    context: 100_000,
    reasoning: true,
  },
};

describe("applyRegistryOverlay", () => {
  test("adds private models missing from the upstream registry", () => {
    const config: LiorConfig = {
      version: 1,
      models: {
        private: {
          provider: "acme",
          id: "private-coder",
          name: "Private Coder",
          context: 32_000,
          tool_call: true,
          cost: { input: 0, output: 0 },
        },
      },
    };

    const result = applyRegistryOverlay(registry, config);
    expect(result["acme/private-coder"]).toEqual({
      provider: "acme",
      id: "private-coder",
      name: "Private Coder",
      context: 32_000,
      output: undefined,
      reasoning: undefined,
      toolCall: true,
      released: undefined,
      cost: { input: 0, output: 0 },
    });
    expect(result).not.toBe(registry);
  });

  test("overrides explicit metadata while retaining upstream defaults", () => {
    const config: LiorConfig = {
      version: 1,
      models: {
        fast: { provider: "openai", id: "existing", name: "Existing (fast)", output: 8_000 },
      },
    };

    const result = applyRegistryOverlay(registry, config);
    expect(result["openai/existing"]).toMatchObject({
      name: "Existing (fast)",
      context: 100_000,
      output: 8_000,
      reasoning: true,
    });
    expect(registry["openai/existing"]?.name).toBe("Existing model");
  });

  test("returns the input registry when no overlay exists", () => {
    expect(applyRegistryOverlay(registry, { version: 1 })).toBe(registry);
  });
});
