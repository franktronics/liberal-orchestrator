/** One model in the normalized registry. Key format: `${provider}/${modelId}`. */
export interface RegistryModel {
  provider: string;
  /** Model id as the provider names it (may itself contain slashes). */
  id: string;
  name: string;
  /** Context window in tokens. */
  context?: number;
  /** Max output tokens. */
  output?: number;
  reasoning?: boolean;
  toolCall?: boolean;
  /** ISO release date, used for sorting. */
  released?: string;
  /** USD per 1M tokens. */
  cost?: { input?: number; output?: number };
}

/** Normalized registry: key `${provider}/${modelId}` → model. */
export type Registry = Record<string, RegistryModel>;

/** On-disk cache shape written by the registry client. */
export interface RegistryCacheFile {
  /** ISO timestamp of the network fetch. */
  fetchedAt: string;
  models: Registry;
}
