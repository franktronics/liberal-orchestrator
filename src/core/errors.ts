/**
 * Error thrown for invalid lior.yaml content or model references.
 * `source` labels the file (or context) the error came from.
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    readonly source?: string,
  ) {
    super(source ? `${source}: ${message}` : message);
    this.name = "ConfigError";
  }
}

/** Error thrown when a model reference cannot be parsed or resolved. */
export class ModelRefError extends ConfigError {}
