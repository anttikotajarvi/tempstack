"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.getConfig = getConfig;
exports.initConfig = initConfig;
exports.resetConfig = resetConfig;
// src/config.ts
const rc_1 = __importDefault(require("rc"));
const DEFAULT_CONFIG = {
    templateDir: "./templates",
    groupDirPrefix: ".",
    LITERAL_EXT: ".json",
    TEMPLATE_EXT: ".js",
};
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
/**
 * Internal helper: merge defaults + rc("tempstack") + explicit overrides.
 *
 * Order of precedence (last wins):
 *   1. DEFAULT_CONFIG
 *   2. rc-config (.tempstackrc, TEMPSTACK_* env, etc.)
 *   3. overrides (e.g. from CLI flags)
 */
function loadConfigInternal(overrides = {}) {
    const rcConfig = (0, rc_1.default)("tempstack", DEFAULT_CONFIG);
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
let cachedConfig = null;
/**
 * Get the current config (lazy-loaded).
 *
 * - On first call: runs rc("tempstack") and caches the result.
 * - On later calls: returns the cached config.
 *
 * Library functions should use this when they don't accept Config as a param.
 */
function getConfig() {
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
function initConfig(overrides = {}) {
    cachedConfig = loadConfigInternal(overrides);
    return cachedConfig;
}
/**
 * Optional utility for tests: clear cached config so the next getConfig()
 * will reload from rc().
 */
function resetConfig() {
    cachedConfig = null;
}
