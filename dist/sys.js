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
exports.apply = exports.ERROR_CODES = void 0;
exports.retrieveTemplate = retrieveTemplate;
exports.resolveTemplateNode = resolveTemplateNode;
exports.render = render;
// src/sys.ts
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const brands_1 = require("./types/brands");
const brands_2 = require("./types/brands");
const convert_1 = require("./types/convert");
const filesystem_1 = require("./filesystem");
const config_1 = require("./config");
/* ============================================================
 * Errors
 * ============================================================ */
var ERROR_CODES;
(function (ERROR_CODES) {
    ERROR_CODES["INVALID_TEMPLATE_ID"] = "invalid-template-id";
    ERROR_CODES["NO_EXPLICIT_FILE_TYPES"] = "no-explicit-file-types";
    ERROR_CODES["NO_DUPLICATE_TEMPLATES"] = "no-duplicate-templates";
    ERROR_CODES["TEMPLATE_NOT_FOUND"] = "template-not-found";
    ERROR_CODES["AMBIGIGUOUS_TEMPLATE_NAME"] = "ambiguous-template-name";
    ERROR_CODES["INVALID_TEMPLATE_TYPE"] = "invalid-template-type";
    ERROR_CODES["INVALID_TEMPLATE_ARGS"] = "invalid-template-args";
    ERROR_CODES["TEMPLATE_EXECUTION_ERROR"] = "template-execution-error";
    ERROR_CODES["INVALID_ANCHOR"] = "invalid-anchor";
    ERROR_CODES["ARRAY_TYPE_MISMATCH"] = "array-type-mismatch";
    ERROR_CODES["UNEXPECTED_READ_ERROR"] = "unexpected-read-error";
    ERROR_CODES["INVALID_OVERRIDE"] = "invalid-override";
    ERROR_CODES["INVALID_PATCH"] = "invalid-patch";
})(ERROR_CODES || (exports.ERROR_CODES = ERROR_CODES = {}));
const error = (processName) => (code, msg, err) => {
    throw new Error(`${code} from ${processName}: ${msg}`);
};
// Wire convert.ts errors into our error style
(0, convert_1.setErr)((code, msg) => {
    throw new Error(`${code}: ${msg}`);
});
/* ============================================================
 * Small JSON helpers
 * ============================================================ */
const isJsonObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const deepMergeObjects = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        const cur = out[k];
        if (isJsonObject(cur) && isJsonObject(v)) {
            out[k] = deepMergeObjects(cur, v);
        }
        else {
            out[k] = v;
        }
    }
    return out;
};
/* ============================================================
 * File readers (strict)
 * ============================================================ */
const readLiteralFile = (absPath) => {
    const E = error("READ_LITERAL");
    const raw = fs.readFileSync((0, brands_2.unwrapFsAbsPath)(absPath), "utf8");
    try {
        return JSON.parse(raw);
    }
    catch (err) {
        return E(ERROR_CODES.UNEXPECTED_READ_ERROR, `invalid-json in file: ${(0, brands_2.unwrapFsAbsPath)(absPath)} (raw length=${raw.length})`, err);
    }
};
const readTemplateFile = (absPath) => {
    var _a, _b, _c, _d;
    const E = error("READ_TEMPLATE_FILE");
    const absStr = (0, brands_2.unwrapFsAbsPath)(absPath);
    try {
        // Ensure Node loads fresh version in tests
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        (_a = require.cache) === null || _a === void 0 ? true : delete _a[require.resolve(absStr)];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(absStr);
        const fn = ((_d = (_b = mod === null || mod === void 0 ? void 0 : mod.default) !== null && _b !== void 0 ? _b : (_c = mod === null || mod === void 0 ? void 0 : mod.module) === null || _c === void 0 ? void 0 : _c.exports) !== null && _d !== void 0 ? _d : mod);
        if (typeof fn !== "function") {
            return E(ERROR_CODES.INVALID_TEMPLATE_TYPE, `Template JS did not export a function: ${absStr}`);
        }
        return fn;
    }
    catch (err) {
        return E(ERROR_CODES.UNEXPECTED_READ_ERROR, `Error requiring template file: ${absStr}`, err);
    }
};
const isTemplateFunction = (v) => typeof v === "function";
const isTemplateLiteral = (v) => !isTemplateFunction(v);
/* ============================================================
 * retrieveTemplate (strict)
 * ============================================================ */
function retrieveTemplate(tPath, rootDirAbs, cfg) {
    const E = error("READ_TEMPLATE");
    const segs = (0, brands_2.unwrapFsRelPath)(tPath);
    if (segs.length === 0) {
        return E(ERROR_CODES.INVALID_TEMPLATE_ID, "Empty template path");
    }
    const dirSegs = segs.slice(0, -1);
    const tagRaw = segs[segs.length - 1];
    // [RULE] no-explicit-file-types
    if (tagRaw.endsWith(cfg.LITERAL_EXT) || tagRaw.endsWith(cfg.TEMPLATE_EXT)) {
        return E(ERROR_CODES.NO_EXPLICIT_FILE_TYPES, `Template tag name must not include file extension: ${tagRaw}`);
    }
    const tagName = (0, brands_2.asTemplateTagName)(tagRaw);
    // Build exact literal and fn absolute paths
    const rootAbsStr = (0, brands_2.unwrapFsAbsPath)(rootDirAbs);
    const literalAbs = (0, brands_2.asFsAbsPath)(path.join(rootAbsStr, ...dirSegs, (0, filesystem_1.literalFilename)(tagName, cfg)));
    const fnAbs = (0, brands_2.asFsAbsPath)(path.join(rootAbsStr, ...dirSegs, (0, filesystem_1.templateFilename)(tagName, cfg)));
    const templateExists = fs.existsSync((0, brands_2.unwrapFsAbsPath)(fnAbs));
    const literalExists = fs.existsSync((0, brands_2.unwrapFsAbsPath)(literalAbs));
    // [RULE] no-duplicate-templates
    if (literalExists && templateExists) {
        return E(ERROR_CODES.NO_DUPLICATE_TEMPLATES, `Template tag resolves to both literal and function: ${tagRaw}`);
    }
    if (templateExists)
        return [readTemplateFile(fnAbs), fnAbs];
    if (literalExists)
        return [readLiteralFile(literalAbs), literalAbs];
    // Shorthand (implicit group traversal)
    {
        // filesystem.ts currently expects TemplateDirAbs; allow arbitrary roots by branding
        const brandedRoot = (0, brands_2.asTemplateDirAbs)(rootAbsStr);
        const hits = (0, filesystem_1.groupAgnosticFind)(brandedRoot, (0, brands_2.asFsRelPath)(dirSegs), tagName, cfg);
        if (hits.length === 0) {
            return E(ERROR_CODES.TEMPLATE_NOT_FOUND, `Template not found: ${segs.join("/")}`);
        }
        if (hits.length > 1) {
            return E(ERROR_CODES.AMBIGIGUOUS_TEMPLATE_NAME, `Multiple matches for template: ${segs.join("/")} -> ${JSON.stringify(hits.map(brands_2.unwrapFsRelPath), null, 2)}`);
        }
        const relHit = hits[0];
        const absHit = (0, convert_1.absFromTemplateDir)(brandedRoot, relHit);
        const absHitStr = (0, brands_2.unwrapFsAbsPath)(absHit);
        if (absHitStr.endsWith(cfg.TEMPLATE_EXT))
            return [readTemplateFile(absHit), absHit];
        if (absHitStr.endsWith(cfg.LITERAL_EXT))
            return [readLiteralFile(absHit), absHit];
        return E(ERROR_CODES.UNEXPECTED_READ_ERROR, `Unrecognized extension for implicit hit: ${absHitStr}`);
    }
}
/* ============================================================
 * apply() (strict + array semantics via slotPath)
 * ============================================================ */
const apply = (tagName, args = {}) => (slotCtx) => {
    const E = error("APPLY_THUNK_EXECUTION");
    const cfg = (0, config_1.getConfig)();
    const caller = slotCtx.template;
    // group::tag parsing (group dirs ONLY use cfg.groupDirPrefix)
    const selector = (0, convert_1.parseApplySelector)(tagName, cfg);
    // Build relative tPath: slotPath + [groupDir?] + tag
    const tPath = (0, convert_1.buildApplyTPath)(slotCtx.slotPath, selector);
    // Root for resolution is caller directory on disk
    const callerDirAbs = (0, convert_1.deriveCallerDirAbs)(caller.templateDir, (0, brands_2.unwrapFsRelPath)(caller.path));
    const [impl, implAbs] = retrieveTemplate(tPath, callerDirAbs, cfg);
    if (isTemplateLiteral(impl)) {
        if (Object.keys(args).length > 0) {
            return E(ERROR_CODES.INVALID_TEMPLATE_ARGS, `Literal template but apply() received args: ${tagName}`);
        }
        return impl;
    }
    if (!isTemplateFunction(impl)) {
        return E(ERROR_CODES.INVALID_TEMPLATE_TYPE, `Template is neither literal nor function: ${tagName}`);
    }
    const fn = impl;
    // slotPath: path inside caller's returned node (may include "[]")
    // slotAnchor: absolute logical path (caller.anchor + slotPath) (may include "[]")
    const slotPathSegs = slotCtx.slotPath.map((s) => String(s));
    const slotAnchorSegs = slotCtx.slotAnchor.map((s) => String(s));
    // TemplateContext.anchor is keys-only (object structure mount), so remove ARRAY_SEG
    const anchorKeysOnly = slotAnchorSegs.filter((s) => s !== brands_1.ARRAY_SEG);
    // TemplateContext.path is filesystem-relative dir to the template directory.
    // This *can* include "[]" because you literally have a directory named "[]".
    const subPathSegs = [
        ...(0, brands_2.unwrapFsRelPath)(caller.path),
        ...slotPathSegs,
        ...(selector.kind === "grouped" ? [String(selector.groupDir)] : []),
    ];
    const subCtx = {
        id: (0, brands_2.asTemplateId)(tagName),
        anchor: (0, brands_2.asTemplateAnchorPath)(anchorKeysOnly),
        templateDir: caller.templateDir,
        path: (0, brands_2.asFsRelPath)(subPathSegs),
        filename: (0, brands_1.asFsFilename)(path.basename((0, brands_2.unwrapFsAbsPath)(implAbs))),
    };
    const tools = { apply: exports.apply };
    const node = fn(args, subCtx, tools);
    return resolveTemplateNode(node, subCtx, (0, brands_2.asFsRelPath)([]));
};
exports.apply = apply;
/* ============================================================
 * resolveTemplateNode (ARRAY FIX: uses [] instead of indices)
 * ============================================================ */
function resolveTemplateNode(node, ctx, nodePath // path inside this template's returned node, as segments
) {
    const E = error("RESOLVE_TEMPLATE_NODE");
    // ApplyThunk
    if (typeof node === "function") {
        const thunk = node;
        // IMPORTANT ARRAY SEMANTICS:
        // nodePath is already a SlotPath-like sequence, where array descent uses ARRAY_SEG.
        const slotPath = nodePath;
        const slotAnchor = (0, convert_1.makeSlotAnchor)(ctx.anchor, slotPath);
        try {
            return thunk({
                template: ctx,
                slotPath,
                slotAnchor,
            });
        }
        catch (err) {
            return E(ERROR_CODES.TEMPLATE_EXECUTION_ERROR, err);
        }
    }
    // Array branch: descend with ARRAY_SEG (NOT indices)
    if (Array.isArray(node)) {
        const out = [];
        for (let i = 0; i < node.length; i++) {
            const child = node[i];
            const nextPath = (0, convert_1.slotPathPushArray)(nodePath);
            out[i] = resolveTemplateNode(child, ctx, nextPath);
        }
        return out;
    }
    // Object branch
    if (isJsonObject(node)) {
        const out = {};
        for (const [key, child] of Object.entries(node)) {
            const nextPath = (0, convert_1.slotPathPushKey)(nodePath, key);
            out[key] = resolveTemplateNode(child, ctx, nextPath);
        }
        return out;
    }
    // Primitive JsonValue
    return node;
}
/* ============================================================
 * render() (implements [] anchor semantics)
 * ============================================================ */
function render(templateIds, args) {
    const E = error("RENDER_TEMPLATES");
    const cfg = (0, config_1.getConfig)();
    const out = {};
    for (const tidRaw of templateIds) {
        const tid = (0, brands_2.asTemplateId)(tidRaw);
        const idPath = (0, convert_1.parseTemplateIdPath)(tid);
        const { dir, tag } = (0, convert_1.splitTemplateIdPath)(idPath);
        // Full filesystem rel path to the template (dir + tag)
        const fullRel = (0, brands_2.asFsRelPath)([...dir, tag]);
        const [impl, implAbs] = retrieveTemplate(fullRel, cfg.templateDir, cfg);
        const mountAnchor = (0, convert_1.deriveMountAnchor)(dir, cfg);
        const { isArrayContributor, pushDepth } = (0, convert_1.deriveArrayContribution)(dir, cfg);
        let node;
        if (isTemplateFunction(impl)) {
            const fn = impl;
            const ctx = {
                id: tid,
                anchor: mountAnchor,
                templateDir: cfg.templateDir,
                path: (0, brands_2.asFsRelPath)(dir),
                filename: path.basename((0, brands_2.unwrapFsAbsPath)(implAbs)),
            };
            const tools = { apply: exports.apply };
            try {
                node = fn(args, ctx, tools);
            }
            catch (err) {
                return E(ERROR_CODES.TEMPLATE_EXECUTION_ERROR, `Error executing template function '${(0, brands_2.unwrapTemplateId)(tid)}': ${err.message}`, err);
            }
            const val = resolveTemplateNode(node, ctx, (0, brands_2.asFsRelPath)([]));
            if (isArrayContributor) {
                pushIntoArrayAtAnchor(out, mountAnchor, val, pushDepth);
            }
            else {
                mergeAtAnchor(out, mountAnchor, val);
            }
        }
        else {
            const val = impl;
            if (isArrayContributor) {
                pushIntoArrayAtAnchor(out, mountAnchor, val, pushDepth);
            }
            else {
                mergeAtAnchor(out, mountAnchor, val);
            }
        }
    }
    const OVERRIDE_TAG = "__override";
    if (OVERRIDE_TAG in args) {
        const overrideRaw = args[OVERRIDE_TAG];
        if (!isJsonObject(overrideRaw)) {
            E(ERROR_CODES.INVALID_OVERRIDE, `__override must be an object`);
        }
        const overrideObj = overrideRaw;
        // merge last: override wins
        const merged = deepMergeObjects(out, overrideObj);
        Object.assign(out, merged);
    }
    // Patch implementation
    const PATCH_TAG = "__patch";
    if (PATCH_TAG in args) {
        const raw = args[PATCH_TAG];
        if (!Array.isArray(raw)) {
            E(ERROR_CODES.INVALID_PATCH, `__patch must be an array of [path, value] entries`);
        }
        const patches = raw;
        for (const entry of patches) {
            if (!Array.isArray(entry) || entry.length !== 2) {
                E(ERROR_CODES.INVALID_PATCH, `Each __patch entry must be [path, value]`);
            }
            const [pathRaw, patchValue] = entry;
            if (typeof pathRaw !== "string") {
                E(ERROR_CODES.INVALID_PATCH, `Patch path must be a string`);
            }
            const rel = parsePatchPath(pathRaw); // FsRelPath
            const segs = (0, brands_2.unwrapFsRelPath)(rel);
            // detect push paths: trailing [] segments
            let pushDepth = 0;
            for (let i = segs.length - 1; i >= 0; i--) {
                if (segs[i] === "[]")
                    pushDepth++;
                else
                    break;
            }
            if (pushDepth > 0) {
                // Array contributor patch: anchor is segs without trailing [] segments
                const dir = (0, brands_2.asFsRelPath)(segs); // pass full dir to your helpers
                const mountAnchor = (0, convert_1.deriveMountAnchor)(dir, cfg);
                const contrib = (0, convert_1.deriveArrayContribution)(dir, cfg);
                // sanity: contrib should match what we calculated
                // (optional, but nice for debugging)
                // if (!contrib.isArrayContributor) ...
                // STRICT: array must already exist at anchor
                const existing = getAtAnchor(out, mountAnchor); // implement or reuse if you have it
                if (!Array.isArray(existing)) {
                    E(ERROR_CODES.ARRAY_TYPE_MISMATCH, // todo: new error code?
                    `Patch push target is not an existing array: ${pathRaw}`);
                }
                pushIntoArrayAtAnchor(out, mountAnchor, patchValue, contrib.pushDepth);
                continue;
            }
            // Normal strict replace patch
            const anchor = (0, brands_2.asTemplateAnchorPath)(segs); // key path
            if (!hasPathStrict(out, anchor)) {
                E(ERROR_CODES.TEMPLATE_NOT_FOUND, `Patch path does not exist: ${pathRaw}`); // todo new error code.
            }
            // Allow patchValue === undefined (deletes in JSON stringify phase, consistent with your system)
            try {
                setPathStrict(out, anchor, patchValue);
            }
            catch (e) {
                E(ERROR_CODES.INVALID_PATCH, e);
            }
        }
    }
    return out;
}
function mergeAtAnchor(out, anchor, val) {
    const E = error("MERGE_AT_ANCHOR");
    const segs = (0, brands_2.unwrapFsRelPath)(anchor);
    if (segs.length === 0) {
        if (isJsonObject(val)) {
            Object.assign(out, deepMergeObjects(out, val));
            return;
        }
        E(ERROR_CODES.INVALID_ANCHOR, `Root-anchored template must return an object`);
    }
    let cur = out;
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const isLast = i === segs.length - 1;
        if (isLast) {
            const existing = cur[seg];
            if (isJsonObject(existing) && isJsonObject(val)) {
                cur[seg] = deepMergeObjects(existing, val);
            }
            else {
                cur[seg] = val;
            }
        }
        else {
            const existing = cur[seg];
            if (!isJsonObject(existing))
                cur[seg] = {};
            cur = cur[seg];
        }
    }
}
function pushIntoArrayAtAnchor(out, anchor, val, pushDepth) {
    const E = error("PUSH_INTO_ARRAY");
    const segs = (0, brands_2.unwrapFsRelPath)(anchor);
    // Wrap val for nested-array contributions: depth=1 => val, depth=2 => [val], depth=3 => [[val]], ...
    const wrapped = wrapForDepth(val, pushDepth);
    // Root anchor array
    if (segs.length === 0) {
        if (!Array.isArray(out)) {
            // out is an object by design; root-level [] contributors are nonsensical in this system
            E(ERROR_CODES.ARRAY_TYPE_MISMATCH, `Root '[]' contributor is not supported`);
        }
        return;
    }
    let cur = out;
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const isLast = i === segs.length - 1;
        if (isLast) {
            const existing = cur[seg];
            if (existing === undefined) {
                cur[seg] = [];
            }
            else if (!Array.isArray(existing)) {
                E(ERROR_CODES.ARRAY_TYPE_MISMATCH, `Cannot push into non-array at '${segs.join("/")}'`);
            }
            cur[seg].push(wrapped);
        }
        else {
            const existing = cur[seg];
            if (!isJsonObject(existing))
                cur[seg] = {};
            cur = cur[seg];
        }
    }
}
function wrapForDepth(val, pushDepth) {
    // pushDepth=1 => val
    // pushDepth=2 => [val]
    // pushDepth=3 => [[val]]
    let out = val;
    for (let i = 1; i < pushDepth; i++) {
        out = [out];
    }
    return out;
}
/* Override and patch helpers */
function parsePatchPath(p) {
    const trimmed = p.trim();
    if (!trimmed)
        throw new Error("empty patch path");
    const segs = trimmed.split("/").filter(Boolean);
    return (0, brands_2.asFsRelPath)(segs);
}
function hasPathStrict(root, anchor) {
    const segs = (0, brands_1.unwrapObjPath)(anchor);
    let cur = root;
    for (let i = 0; i < segs.length; i++) {
        const k = segs[i];
        const isLast = i === segs.length - 1;
        if (!isJsonObject(cur))
            return false;
        if (isLast) {
            return k in cur; // allows existing-but-undefined
        }
        if (!(k in cur))
            return false;
        cur = cur[k];
    }
    return true;
}
/**
 * @throws string
 */
function setPathStrict(root, anchor, value) {
    const segs = (0, brands_1.unwrapObjPath)(anchor);
    let cur = root;
    for (let i = 0; i < segs.length; i++) {
        const k = segs[i];
        const isLast = i === segs.length - 1;
        if (!isJsonObject(cur)) {
            throw `non-object encountered at ${segs.slice(0, i).join("/")}`;
        }
        if (isLast) {
            cur[k] = value;
            return;
        }
        if (!(k in cur)) {
            throw new Error(`missing path at ${segs.slice(0, i + 1).join("/")}`);
        }
        cur = cur[k];
    }
}
function getAtAnchor(root, anchor) {
    const segs = (0, brands_1.unwrapObjPath)(anchor);
    let cur = root;
    for (const s of segs) {
        if (!isJsonObject(cur))
            return undefined;
        cur = cur[s];
    }
    return cur;
}
