import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTextFileAtomic } from "../util/io";
import { ConfigError } from "./errors";
import { loadConfig, mergeConfigs } from "./loader";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "lior-loader-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  test("merges global < project with key-by-key binding precedence", async () => {
    const globalPath = join(dir, "global.yaml");
    const projectPath = join(dir, "lior.yaml");
    writeTextFileAtomic(
      globalPath,
      [
        "bindings:",
        "  orchestrator: old-model",
        "  tester: glm",
        "models:",
        "  glm: { provider: zhipuai, id: glm-5.3 }",
      ].join("\n"),
    );
    writeTextFileAtomic(projectPath, ["bindings:", "  orchestrator: astra#high"].join("\n"));

    const { config, sources } = await loadConfig({ globalPath, projectPath });
    expect(sources).toEqual([globalPath, projectPath]);
    expect(config.bindings?.orchestrator).toBe("astra#high");
    expect(config.bindings?.tester).toBe("glm"); // kept from global
    expect(config.models?.glm).toEqual({ provider: "zhipuai", id: "glm-5.3" });
  });

  test("returns an empty config when no file exists", async () => {
    const { config, sources } = await loadConfig({
      globalPath: join(dir, "missing.yaml"),
      projectPath: join(dir, "also-missing.yaml"),
    });
    expect(sources).toEqual([]);
    expect(config.version).toBe(1);
  });

  test("surfaces YAML errors with the offending file path", async () => {
    const brokenPath = join(dir, "broken.yaml");
    writeTextFileAtomic(brokenPath, "bindings: [");
    await expect(loadConfig({ projectPath: brokenPath })).rejects.toThrow(ConfigError);
    await expect(loadConfig({ projectPath: brokenPath })).rejects.toThrow(
      new RegExp(brokenPath.replaceAll("/", "\\/")),
    );
  });
});

describe("mergeConfigs", () => {
  test("project replaces arrays wholesale", () => {
    const merged = mergeConfigs([
      { version: 1, harness: ["opencode", "codex"] },
      { version: 1, harness: ["codex"] },
    ]);
    expect(merged.harness).toEqual(["codex"]);
  });
});
