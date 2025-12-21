// src/config.ts
import rc from "rc";
import { Config } from "./types";

const DEFAULT_CONFIG: Config = {
  templateDir: "./templates",
  groupDirPrefix: ".",
  LITERAL_EXT: ".json",
  TEMPLATE_EXT: ".js",
};

/**
 * Internal helper: merge defaults + rc("tempstack") + explicit overrides.
 *
 * Order of precedence (last wins):
 *   1. DEFAULT_CONFIG
 *   2. rc-config (.tempstackrc, TEMPSTACK_* env, etc.)
 *   3. overrides (e.g. from CLI flags)
 */
function loadConfigInternal(overrides: Partial<Config> = {}): Config {
  const rcConfig = rc("tempstack", DEFAULT_CONFIG) as Partial<Config>;

  return {
    ...DEFAULT_CONFIG,
    ...rcConfig,
    ...overrides
  };
}

/**
 * Cached config for this process. This is what library code uses
 * when no explicit overrides are supplied (e.g. normal npm usage).
 */
let cachedConfig: Config | null = null;

/**
 * Get the current config (lazy-loaded).
 *
 * - On first call: runs rc("tempstack") and caches the result.
 * - On later calls: returns the cached config.
 *
 * Library functions should use this when they don't accept Config as a param.
 */
export function getConfig(): Config {
  if (cachedConfig == null) {
    cachedConfig = loadConfigInternal();
  }
  return cachedConfig;
}

/**
 * Initialize or override the global config for this process.
 *
 * - CLI should call this *once* at startup with any CLI-derived overrides.
 * - After this, getConfig() will return this config.
 */
export function initConfig(overrides: Partial<Config> = {}): Config {
  cachedConfig = loadConfigInternal(overrides);
  return cachedConfig;
}

/**
 * Optional utility for tests: clear cached config so the next getConfig()
 * will reload from rc().
 */
export function resetConfig(): void {
  cachedConfig = null;
}

// Export defaults in case they're useful for docs/tests
export { DEFAULT_CONFIG };
