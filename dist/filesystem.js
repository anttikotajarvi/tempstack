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
exports.groupAgnosticFindWithFs = exports.tagNameFromFilename = exports.templateFilename = exports.literalFilename = exports.HIDDEN_FILE_PREFIX = void 0;
const path = __importStar(require("path"));
exports.HIDDEN_FILE_PREFIX = ".";
const literalFilename = (tagName) => `${tagName}.json`;
exports.literalFilename = literalFilename;
const templateFilename = (tagName) => `${tagName}.js`;
exports.templateFilename = templateFilename;
const tagNameFromFilename = (filename) => {
    if (filename.endsWith(".json")) {
        return filename.slice(0, -5);
    }
    if (filename.endsWith(".js")) {
        return filename.slice(0, -3);
    }
    return filename;
};
exports.tagNameFromFilename = tagNameFromFilename;
const _groupAgnosticFind = (fs) => (dirPath, tagName, cfg) => {
    const visit = (currentPath, i) => {
        const hits = [];
        const dirFsPath = path.join(cfg.templateDir, ...currentPath);
        if (!fs.existsSync(dirFsPath)) {
            return hits;
        }
        const entries = fs.readdirSync(dirFsPath, { withFileTypes: true });
        if (i === dirPath.length) {
            // We've matched all anchor segments for dirPath.
            // 1) Collect files with matching tagName in this directory.
            for (const entry of entries) {
                if (entry.isFile()) {
                    if ((0, exports.tagNameFromFilename)(entry.name) === tagName) {
                        hits.push([...currentPath, entry.name]);
                    }
                }
            }
            // 2) Recurse into group dirs without advancing i (still same anchor level).
            for (const entry of entries) {
                if (entry.isDirectory() &&
                    (entry.name.startsWith(cfg.groupDirPrefix) ||
                        entry.name.startsWith(exports.HIDDEN_FILE_PREFIX))) {
                    hits.push(...visit([...currentPath, entry.name], i));
                }
            }
            return hits;
        }
        const segment = dirPath[i];
        // We haven't matched all anchor segments yet.
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name === segment) {
                // This directory matches the next anchor segment:
                // consume one segment and recurse.
                hits.push(...visit([...currentPath, entry.name], i + 1));
            }
            else if (entry.name.startsWith(cfg.groupDirPrefix) ||
                entry.name.startsWith(exports.HIDDEN_FILE_PREFIX)) {
                // Group dir: we don't consume an anchor segment,
                // just recurse with same i.
                hits.push(...visit([...currentPath, entry.name], i));
            }
        }
        return hits;
    };
    return visit([], 0);
};
exports.groupAgnosticFindWithFs = _groupAgnosticFind;
