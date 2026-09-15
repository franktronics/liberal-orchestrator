import { tmpdir } from "node:os";
import { join } from "node:path";

/** Filesystem locations lior uses, honoring the usual environment overrides. */
export interface LiorPaths {
  /** Cache directory (registry cache). Overridable with LIOR_CACHE_DIR (tests). */
  cacheDir: string;
  /** Global user configuration file. */
  globalConfigPath: string;
}

/**
 * Resolves lior's paths from an environment (defaults to process.env).
 * Honors HOME/USERPROFILE, XDG_CONFIG_HOME, XDG_CACHE_HOME, LIOR_CACHE_DIR.
 */
export function resolvePaths(env: Record<string, string | undefined> = process.env): LiorPaths {
  const home = env.HOME ?? env.USERPROFILE;
  const configHome = env.XDG_CONFIG_HOME ?? (home ? join(home, ".config") : undefined);
  const cacheHome = env.XDG_CACHE_HOME ?? (home ? join(home, ".cache") : undefined);

  const cacheDir =
    env.LIOR_CACHE_DIR ?? (cacheHome ? join(cacheHome, "lior") : join(tmpdir(), "lior"));
  const globalConfigPath = configHome
    ? join(configHome, "lior", "lior.yaml")
    : join(tmpdir(), "lior", "lior.yaml");

  return { cacheDir, globalConfigPath };
}
