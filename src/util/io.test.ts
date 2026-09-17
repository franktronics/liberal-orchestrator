import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findFileUp, writeTextFileAtomic } from "./io";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "lior-discovery-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("findFileUp", () => {
  test("finds the nearest config from a nested directory", () => {
    const nested = join(dir, "packages", "app", "src");
    mkdirSync(nested, { recursive: true });
    const expected = join(dir, "lior.yaml");
    writeTextFileAtomic(expected, "version: 1\n");

    expect(findFileUp("lior.yaml", nested)).toBe(expected);
  });

  test("prefers a closer config", () => {
    const nested = join(dir, "packages", "app", "src");
    const expected = join(dir, "packages", "app", "lior.yaml");
    writeTextFileAtomic(expected, "version: 1\n");

    expect(findFileUp("lior.yaml", nested)).toBe(expected);
  });

  test("returns null when the file is absent", () => {
    expect(findFileUp("definitely-missing.yaml", dir)).toBeNull();
  });
});
