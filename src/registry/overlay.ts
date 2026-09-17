import type { LiorConfig, ModelSpec } from "../core/types";
import type { Registry, RegistryModel } from "./types";

/**
 * Applies `lior.yaml` model definitions to a registry snapshot.
 *
 * Existing catalog entries retain upstream metadata unless explicitly
 * overridden. Unknown/private models become synthetic registry entries so
 * aliases work in both `models search` and `models info` while offline.
 */
export function applyRegistryOverlay(registry: Registry, config?: LiorConfig): Registry {
  const models = config?.models;
  if (!models || Object.keys(models).length === 0) {
    return registry;
  }

  const overlaid = { ...registry };
  for (const [alias, spec] of Object.entries(models)) {
    const key = `${spec.provider}/${spec.id}`;
    overlaid[key] = mergeModel(overlaid[key], spec, alias);
  }
  return overlaid;
}

function mergeModel(
  existing: RegistryModel | undefined,
  spec: ModelSpec,
  alias: string,
): RegistryModel {
  return {
    provider: spec.provider,
    id: spec.id,
    name: spec.name ?? existing?.name ?? alias,
    context: spec.context ?? existing?.context,
    output: spec.output ?? existing?.output,
    reasoning: spec.reasoning ?? existing?.reasoning,
    toolCall: spec.tool_call ?? existing?.toolCall,
    released: spec.released ?? existing?.released,
    cost: spec.cost ?? existing?.cost,
  };
}
