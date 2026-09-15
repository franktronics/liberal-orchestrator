import type { Registry, RegistryModel } from "./types";

interface RawModel {
  name?: string;
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number };
  reasoning?: boolean;
  tool_call?: boolean;
  release_date?: string;
}

interface RawProvider {
  models?: Record<string, RawModel | undefined>;
}

/**
 * Normalizes the models.dev api.json payload into our Registry shape.
 * Stores normalized models (not the raw payload) so the cache format stays
 * stable if upstream drifts.
 *
 * Skips providers without models and entries without a context window
 * (image/audio-only models lior cannot route to).
 */
export function normalizeApiJson(raw: unknown): Registry {
  const registry: Registry = {};
  if (raw == null || typeof raw !== "object") {
    return registry;
  }

  for (const [providerId, providerValue] of Object.entries(raw as Record<string, unknown>)) {
    const provider = providerValue as RawProvider | null;
    if (provider == null || typeof provider !== "object" || provider.models == null) {
      continue;
    }
    for (const [modelId, modelValue] of Object.entries(provider.models)) {
      const model = modelValue as RawModel | null;
      const context = model?.limit?.context ?? 0;
      if (!model || !context) {
        continue;
      }
      const cost =
        model.cost?.input !== undefined || model.cost?.output !== undefined
          ? { input: model.cost?.input, output: model.cost?.output }
          : undefined;
      const entry: RegistryModel = {
        provider: providerId,
        id: modelId,
        name: model.name ?? modelId,
        context,
        output: model.limit?.output,
        reasoning: model.reasoning === true,
        toolCall: model.tool_call === true,
        released: model.release_date,
        cost,
      };
      registry[`${providerId}/${modelId}`] = entry;
    }
  }
  return registry;
}
