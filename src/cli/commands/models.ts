import { join } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { loadConfig } from "../../core/loader";
import { parseModelRef } from "../../core/modelref";
import { getRegistry } from "../../registry/client";
import { applyRegistryOverlay } from "../../registry/overlay";
import { aliasMap, searchModels } from "../../registry/search";
import type { RegistryModel } from "../../registry/types";
import { findFileUp } from "../../util/io";
import { resolvePaths } from "../../util/paths";

export const modelsCommand = defineCommand({
  meta: {
    name: "models",
    description: "Search the model registry (models.dev + lior.yaml aliases)",
  },
  args: {
    offline: {
      type: "boolean",
      description: "Never hit the network (cache or bundled snapshot only)",
    },
  },
  run: async ({ args }) => {
    try {
      const positional = ((args._ as string[]) ?? []).filter((a) => !a.startsWith("-"));
      const keyword = positional[0] === "info" || positional[0] === "search" ? positional[0] : null;
      const command = keyword === "info" ? "info" : "search";
      const term = (keyword ? positional.slice(1) : positional).join(" ").trim();

      if (command === "info") {
        if (!term) {
          fail("usage: lior models info <provider/model | alias>");
        }
        await showInfo(term, args.offline === true);
      } else {
        await showSearch(term, args.offline === true);
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  },
});

async function loadContext(offline: boolean) {
  const paths = resolvePaths();
  const projectPath = findFileUp("lior.yaml") ?? undefined;
  const { config } = await loadConfig({
    projectPath,
    globalPath: paths.globalConfigPath,
  });
  const result = await getRegistry({
    cachePath: join(paths.cacheDir, "registry.json"),
    allowNetwork: !offline,
  });
  if (result.warning) {
    console.error(pc.yellow(result.warning));
  }
  return {
    config,
    result: { ...result, registry: applyRegistryOverlay(result.registry, config) },
  };
}

async function showSearch(term: string, offline: boolean): Promise<void> {
  const { config, result } = await loadContext(offline);
  const hits = searchModels(result.registry, term, { aliases: aliasMap(config), limit: 20 });

  const header = term ? `Models matching "${term}"` : "Latest models";
  console.log(pc.bold(`${header} ${pc.dim(`(source: ${result.source})`)}`));
  if (hits.length === 0) {
    console.log(pc.dim("no results"));
    return;
  }
  for (const hit of hits) {
    const alias = hit.alias ? pc.magenta(` (alias: ${hit.alias})`) : "";
    console.log(`  ${pc.green(hit.key)}${alias} ${pc.dim(describe(hit.model))}`);
  }
}

async function showInfo(term: string, offline: boolean): Promise<void> {
  const { config, result } = await loadContext(offline);
  const ref = parseModelRef(term, config);
  const key = `${ref.provider}/${ref.model}`;
  const model = result.registry[key];
  if (!model) {
    fail(`model "${key}" not found in the registry (source: ${result.source})`);
  }
  const alias = Object.entries(aliasMap(config)).find(([, k]) => k === key)?.[0];
  console.log(pc.bold(pc.green(key)) + (alias ? pc.magenta(`  (alias: ${alias})`) : ""));
  console.log(`  name:      ${model.name}`);
  if (model.context) console.log(`  context:   ${formatTokens(model.context, "ctx")}`);
  if (model.output) console.log(`  output:    ${formatTokens(model.output, "out")}`);
  if (model.cost) {
    console.log(`  cost/1M:   $${model.cost.input ?? "?"} in / $${model.cost.output ?? "?"} out`);
  }
  console.log(`  reasoning: ${model.reasoning ? "yes" : "no"}`);
  console.log(`  tools:     ${model.toolCall ? "yes" : "no"}`);
  if (model.released) console.log(`  released:  ${model.released}`);
}

function describe(model: RegistryModel): string {
  const parts: string[] = [model.name];
  if (model.context) {
    parts.push(formatTokens(model.context, "ctx"));
  }
  if (model.cost) {
    parts.push(`$${model.cost.input ?? "?"}/$${model.cost.output ?? "?"} per 1M`);
  }
  return parts.join(" — ");
}

function formatTokens(tokens: number, unit: string): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M ${unit}`;
  }
  return `${Math.round(tokens / 1000)}k ${unit}`;
}

function fail(message: string): never {
  console.error(pc.red(`error: ${message}`));
  process.exit(1);
}
