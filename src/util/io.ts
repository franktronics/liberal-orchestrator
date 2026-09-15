import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * The only place (with adapter writers) allowed to touch the filesystem.
 * Everything else in lior stays pure and testable.
 */

/** Reads a text file, returning null when it does not exist. */
export function readTextFile(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, "utf8");
}

/** Reads and parses a JSON file, returning null when it does not exist. */
export function readJsonFile<T>(path: string): T | null {
  const text = readTextFile(path);
  if (text === null) {
    return null;
  }
  return JSON.parse(text) as T;
}

/** Ensures the parent directory exists. */
export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/** Writes via a tmp file + rename so readers never see partial content. */
export function writeTextFileAtomic(path: string, content: string): void {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
}

/** JSON variant of writeTextFileAtomic. */
export function writeJsonFileAtomic(path: string, value: unknown): void {
  writeTextFileAtomic(path, `${JSON.stringify(value)}\n`);
}
