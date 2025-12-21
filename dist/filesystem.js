"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupAgnosticFind = exports.groupAgnosticFindWithFs = exports.isGroupDir = exports.tagNameFromFilename = exports.templateFilename = exports.literalFilename = exports.HIDDEN_FILE_PREFIX = void 0;
const _fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const brands_1 = require("./types/brands");
/**
 * Hidden file/dir prefix.
 *
 * IMPORTANT: We do NOT traverse these automatically.
 * If you set cfg.groupDirPrefix=".", then dot-dirs are groups (and therefore traversed),
 * but if you set cfg.groupDirPrefix to something else (e.g. "_"), dot-dirs are hidden
 * and will not be traversed.
 */
exports.HIDDEN_FILE_PREFIX = ".";
/** Build literal filename from tag name. */
const literalFilename = (tagName, cfg) => (0, brands_1.asFsFilename)(`${tagName}${cfg.LITERAL_EXT}`);
exports.literalFilename = literalFilename;
/** Build function template filename from tag name. */
const templateFilename = (tagName, cfg) => (0, brands_1.asFsFilename)(`${tagName}${cfg.TEMPLATE_EXT}`);
exports.templateFilename = templateFilename;
/** Extract template tag name from filename (drops extension). */
const tagNameFromFilename = (filename) => (0, brands_1.asTemplateTagName)(path.parse(filename).name);
exports.tagNameFromFilename = tagNameFromFilename;
/**
 * True if entry is a “group dir” that should be traversed for implicit lookups.
 *
 * NOTE: We deliberately do NOT traverse hidden dirs here.
 * Hidden dirs are only “implicitly group dirs” when cfg.groupDirPrefix === "."
 * (because then they *are* group dirs).
 */
const isGroupDir = (name, cfg) => name.startsWith(cfg.groupDirPrefix);
exports.isGroupDir = isGroupDir;
/**
 * Find all matching files for (dirPath, tagName), searching through group dirs implicitly.
 *
 * Returns filesystem-relative paths (segments) from the template root directory:
 *   e.g. ["render",".a","look","default.json"]
 */
const _groupAgnosticFind = (fs) => (rootDir, dirPath, tagName, cfg) => {
    const visit = (currentPath, i) => {
        const hits = [];
        const dirFsPath = path.join((0, brands_1.unwrapFsAbsPath)(rootDir), ...currentPath);
        if (!fs.existsSync(dirFsPath))
            return hits;
        const entries = fs.readdirSync(dirFsPath, { withFileTypes: true });
        const anchorSegs = (0, brands_1.unwrapFsRelPath)(dirPath);
        if (i === anchorSegs.length) {
            // Anchor fully matched.
            // 1) Prefer exact directory hits.
            for (const entry of entries) {
                if (!entry.isFile())
                    continue;
                if ((0, exports.tagNameFromFilename)(entry.name) === tagName) {
                    hits.push([...currentPath, entry.name]);
                }
            }
            // If exact hits exist, do NOT infer group variants.
            if (hits.length > 0) {
                return hits;
            }
            // 2) Otherwise infer via group dirs at this anchor level.
            for (const entry of entries) {
                if (entry.isDirectory() && (0, exports.isGroupDir)(entry.name, cfg)) {
                    hits.push(...visit([...currentPath, entry.name], i));
                }
            }
            return hits;
        }
        const segment = anchorSegs[i];
        // Not done matching anchor segments yet:
        // - follow exact segment matches
        // - also traverse into group dirs without consuming anchor segments
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name === segment) {
                hits.push(...visit([...currentPath, entry.name], i + 1));
            }
            else if ((0, exports.isGroupDir)(entry.name, cfg)) {
                hits.push(...visit([...currentPath, entry.name], i));
            }
        }
        return hits;
    };
    const rawHits = visit([], 0);
    return rawHits.map((h) => (0, brands_1.asFsRelPath)(h));
};
exports.groupAgnosticFindWithFs = _groupAgnosticFind;
exports.groupAgnosticFind = _groupAgnosticFind(_fs);
