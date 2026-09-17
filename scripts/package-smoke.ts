#!/usr/bin/env bun
/** Builds, packs, installs, and executes the npm CLI artifact. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const sandbox = mkdtempSync(join(tmpdir(), "lior-package-smoke-"));

try {
  const packOutput = execFileSync("npm", ["pack", "--pack-destination", sandbox], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const filename = packOutput.trim().split("\n").at(-1);
  if (!filename) {
    throw new Error("npm pack did not return a package filename");
  }

  const installRoot = join(sandbox, "install");
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--prefix", installRoot, join(sandbox, filename)],
    { cwd: projectRoot, stdio: "inherit" },
  );
  execFileSync(join(installRoot, "node_modules", ".bin", "lior"), ["--help"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
