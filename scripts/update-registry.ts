#!/usr/bin/env bun
/**
 * Refreshes the bundled registry snapshot from models.dev.
 *
 * Usage: bun scripts/update-registry.ts
 * Run before every release (see PLAN.md Phase 5).
 */
import { fileURLToPath } from "node:url";
import { MODELS_DEV_URL } from "../src/registry/client";
import { normalizeApiJson } from "../src/registry/normalize";
import type { Registry } from "../src/registry/types";
import { writeTextFileAtomic } from "../src/util/io";

const response = await fetch(MODELS_DEV_URL, { headers: { accept: "application/json" } });
if (!response.ok) {
  throw new Error(`fetching ${MODELS_DEV_URL} failed: HTTP ${response.status}`);
}
const raw: unknown = await response.json();

const registry = normalizeApiJson(raw);
const sorted: Registry = {};
for (const key of Object.keys(registry).sort()) {
  const model = registry[key];
  if (model) {
    sorted[key] = model;
  }
}

const target = fileURLToPath(new URL("../src/registry/snapshot.json", import.meta.url));
writeTextFileAtomic(target, JSON.stringify(sorted));

const sizeKb = Math.round(JSON.stringify(sorted).length / 1024);
console.log(`snapshot written: ${Object.keys(sorted).length} models, ${sizeKb} kB → ${target}`);
