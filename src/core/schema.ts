import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ConfigError } from "./errors";
import type { LiorConfig } from "./types";

export const effortSchema = z.enum(["minimal", "low", "medium", "high", "xhigh", "max"]);
export const harnessSchema = z.enum(["opencode", "codex"]);

const modelSpecSchema = z.object({
  provider: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  context: z.number().int().positive().optional(),
  output: z.number().int().positive().optional(),
  reasoning: z.boolean().optional(),
  tool_call: z.boolean().optional(),
  released: z.string().date().optional(),
  cost: z
    .object({
      input: z.number().nonnegative().optional(),
      output: z.number().nonnegative().optional(),
    })
    .optional(),
});

const providerSpecSchema = z.object({
  base_url: z.string().url().optional(),
  env: z.string().min(1).optional(),
  wire_api: z.enum(["responses", "chat", "anthropic"]).optional(),
});

const bindingSchema = z.union([
  z.string().min(1),
  z.object({
    model: z.string().min(1),
    opencode: z.string().min(1).optional(),
    codex: z.string().min(1).optional(),
  }),
]);

export const liorConfigSchema = z.object({
  version: z.literal(1).default(1),
  harness: z.array(harnessSchema).min(1).optional(),
  models: z.record(z.string().min(1), modelSpecSchema).optional(),
  bindings: z.record(z.string().min(1), bindingSchema).optional(),
  providers: z.record(z.string().min(1), providerSpecSchema).optional(),
  presets: z.record(z.string().min(1), z.record(z.string().min(1), z.string().min(1))).optional(),
});

/** Validates an already-parsed config object, throwing ConfigError on failure. */
export function validateConfig(value: unknown, source = "lior.yaml"): LiorConfig {
  const result = liorConfigSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.errors
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`invalid configuration — ${details}`, source);
  }
  return result.data as LiorConfig;
}

/** Parses and validates lior.yaml content. */
export function parseConfig(sourceText: string, source = "lior.yaml"): LiorConfig {
  let raw: unknown;
  try {
    raw = parseYaml(sourceText);
  } catch (err) {
    throw new ConfigError(`YAML syntax error — ${(err as Error).message}`, source);
  }
  if (raw == null) {
    return validateConfig({}, source);
  }
  if (typeof raw !== "object") {
    throw new ConfigError("expected a YAML mapping at the top level", source);
  }
  return validateConfig(raw, source);
}
