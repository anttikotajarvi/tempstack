import { Config } from "./types";
declare const DEFAULT_CONFIG: Config;
/**
 * Get the current config (lazy-loaded).
 *
 * - On first call: runs rc("tempstack") and caches the result.
 * - On later calls: returns the cached config.
 *
 * Library functions should use this when they don't accept Config as a param.
 */
export declare function getConfig(): Config;
/**
 * Initialize or override the global config for this process.
 *
 * - CLI should call this *once* at startup with any CLI-derived overrides.
 * - After this, getConfig() will return this config.
 */
export declare function initConfig(overrides?: Partial<Config>): Config;
/**
 * Optional utility for tests: clear cached config so the next getConfig()
 * will reload from rc().
 */
export declare function resetConfig(): void;
export { DEFAULT_CONFIG };
