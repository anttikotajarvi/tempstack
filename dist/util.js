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
exports.splitPath = splitPath;
exports.isJsonObject = isJsonObject;
exports.deepMergeObjects = deepMergeObjects;
const path = __importStar(require("path"));
function splitPath(filePath) {
    const { root, dir, base } = path.parse(filePath);
    const parts = [];
    // Keep the root ("/", "C:\\", "\\\\server\\share\\", etc.)
    if (root)
        parts.push(root);
    // dir without root (e.g. "home/user" from "/home/user")
    const dirWithoutRoot = dir && root && dir.startsWith(root) ? dir.slice(root.length) : dir;
    if (dirWithoutRoot) {
        parts.push(...dirWithoutRoot
            .split(path.sep)
            .filter(Boolean) // removes empty strings
        );
    }
    // Finally, the file/last segment name
    if (base)
        parts.push(base);
    return parts;
}
function isJsonObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
function deepMergeObjects(a, b) {
    // placeholder – you’ll implement real merge rules later
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        if (isJsonObject(v) && isJsonObject(out[k])) {
            out[k] = deepMergeObjects(out[k], v);
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
