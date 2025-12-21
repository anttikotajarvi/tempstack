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
exports.apply = void 0;
exports.retrieveTemplate = retrieveTemplate;
exports.resolveTemplateNode = resolveTemplateNode;
exports.render = render;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const brands_1 = require("./types/brands");
const convert_1 = require("./types/convert");
const filesystem_1 = require("./filesystem");
const config_1 = require("./config");
/* ============================================================
 * Helpers
 * ============================================================ */
const isJsonObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isTemplateFunction = (v) => typeof v === "function";
const readLiteralFile = (absPath) => {
    const raw = fs.readFileSync(absPath, "utf8");
    let val = "";
    try {
        val = JSON.parse(raw);
    }
    catch {
        console.log(`invalid-json in file: ${absPath}`, raw);
        throw new Error(`invalid-json: ${absPath}`);
    }
    return val;
};
const readTemplateFile = (absPath) => {
    var _a;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(absPath);
    return ((_a = mod === null || mod === void 0 ? void 0 : mod.default) !== null && _a !== void 0 ? _a : mod);
};
/**
 * Deep merge for objects; arrays are REPLACE by default (your current rule).
 * (Array append is handled via the [] contributor mechanism, not via merge.)
 */
const deepMergeObjects = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        const av = out[k];
        if (isJsonObject(av) && isJsonObject(v)) {
            out[k] = deepMergeObjects(av, v);
        }
        else {
            out[k] = v;
        }
    }
    return out;
};
/* ============================================================
 * retrieveTemplate (strict, relative-to-root)
 * ============================================================ */
function retrieveTemplate(tPath, // filesystem-relative segments (dirs + tag)
rootDirAbs) {
    const cfg = (0, config_1.getConfig)();
    const segs = (0, brands_1.unwrapFsRelPath)(tPath);
    if (segs.length === 0) {
        throw new Error(`invalid-template-id: empty template path`);
    }
    const dirSegs = segs.slice(0, -1);
    const tagRaw = segs[segs.length - 1];
    const tagName = (0, brands_1.asTemplateTagName)(tagRaw);
    // rule: no explicit file types
    if (tagRaw.endsWith(cfg.LITERAL_EXT) ||
        tagRaw.endsWith(cfg.TEMPLATE_EXT)) {
        throw new Error(`no-explicit-file-types: '${tagRaw}'`);
    }
    const literalAbs = path.join((0, brands_1.unwrapFsAbsPath)(rootDirAbs), ...dirSegs, (0, filesystem_1.literalFilename)(tagName, cfg));
    const fnAbs = path.join((0, brands_1.unwrapFsAbsPath)(rootDirAbs), ...dirSegs, (0, filesystem_1.templateFilename)(tagName, cfg));
    const literalExists = fs.existsSync(literalAbs);
    const fnExists = fs.existsSync(fnAbs);
    if (literalExists && fnExists) {
        throw new Error(`no-duplicate-templates: '${tagRaw}' resolves to both ${literalAbs} and ${fnAbs}`);
    }
    if (fnExists)
        return [readTemplateFile(fnAbs), fnAbs];
    if (literalExists)
        return [readLiteralFile(literalAbs), literalAbs];
    // implicit group lookup
    const hits = (0, filesystem_1.groupAgnosticFind)(rootDirAbs, (0, brands_1.asFsRelPath)(dirSegs), tagName, cfg);
    if (hits.length === 0) {
        throw new Error(`template-not-found: '${tPath.join("/")}'`);
    }
    if (hits.length > 1) {
        throw new Error(`ambiguous-template-name: '${tPath.join("/")}' hits=${JSON.stringify(hits.map((h) => (0, brands_1.unwrapFsRelPath)(h)), null, 2)}`);
    }
    const hitAbs = path.join((0, brands_1.unwrapFsAbsPath)(rootDirAbs), ...(0, brands_1.unwrapFsRelPath)(hits[0]));
    if (hitAbs.endsWith(cfg.TEMPLATE_EXT))
        return [readTemplateFile(hitAbs), hitAbs];
    if (hitAbs.endsWith(cfg.LITERAL_EXT))
        return [readLiteralFile(hitAbs), hitAbs];
    throw new Error(`uncaught-exception: unrecognized extension: ${hitAbs}`);
}
/* ============================================================
 * apply() + resolveTemplateNode() with array semantics
 * ============================================================ */
const apply = (tagNameRaw, args = {}) => {
    const cfg = (0, config_1.getConfig)();
    const selector = (0, convert_1.parseApplySelector)(tagNameRaw, cfg);
    const thunk = (slotCtx) => {
        const caller = slotCtx.template;
        // Build tPath relative to caller directory:
        // tPath = slotPath + [groupDir?] + tag
        const tPathRel = (0, convert_1.buildApplyTPath)(slotCtx.slotPath, selector);
        // Root dir for this resolution is the caller's directory on disk
        const callerDirAbs = (0, convert_1.deriveCallerDirAbs)(caller.templateDir, (0, brands_1.unwrapFsRelPath)(caller.path));
        const [impl, implAbsPath] = retrieveTemplate(tPathRel, (0, brands_1.asTemplateDirAbs)((0, brands_1.unwrapFsAbsPath)(callerDirAbs)));
        // Literal
        if (!isTemplateFunction(impl)) {
            if (Object.keys(args).length > 0) {
                throw new Error(`invalid-template-args: literal template '${(0, brands_1.toFsRelPathStr)(tPathRel)}' called with args`);
            }
            return impl;
        }
        // Function
        const fn = impl;
        // Subtemplate context:
        // - anchor should be the *slotAnchor* of where it’s being applied (includes [] markers there)
        //   BUT TemplateContext.anchor is keys-only mount anchor, so we must derive keys-only part.
        //   The mount anchor for applied template is still the caller's mount anchor plus slotPath up to first [].
        //
        // In practice: slotCtx.slotAnchor is SlotAnchor (may include []).
        // We keep TemplateContext.anchor keys-only by stripping everything after first [].
        const fullSlotAnchor = slotCtx.slotAnchor;
        const slotSegs = (0, brands_1.unwrapSlotPath)(fullSlotAnchor);
        const firstArray = slotSegs.findIndex((s) => s === brands_1.ARRAY_SEG);
        const mountKeys = firstArray === -1 ? slotSegs : slotSegs.slice(0, firstArray);
        const subAnchor = (0, brands_1.asTemplateAnchorPath)(mountKeys);
        // The fs path for this subtemplate dir is caller.path + slotPath(fs) (+ group dir if used)
        const subDirSegs = (0, brands_1.unwrapFsRelPath)(tPathRel).slice(0, -1);
        const subPath = (0, brands_1.asFsRelPath)([...(0, brands_1.unwrapFsRelPath)(caller.path), ...subDirSegs]);
        const subCtx = {
            id: (0, brands_1.asTemplateId)(tagNameRaw),
            anchor: subAnchor,
            templateDir: caller.templateDir,
            path: subPath,
            filename: path.basename(implAbsPath)
        };
        const tools = { apply: exports.apply };
        const node = fn(args, subCtx, tools);
        return resolveTemplateNode(node, subCtx, (0, brands_1.asSlotPath)([]));
    };
    return thunk;
};
exports.apply = apply;
/**
 * Resolve a TemplateNode into a pure JsonValue.
 *
 * IMPORTANT:
 * - Arrays push ARRAY_SEG into slotPath (not numeric indices).
 * - This is the mechanism that makes apply() inside arrays resolve from .../[]/...
 */
function resolveTemplateNode(node, ctx, nodePath) {
    // ApplyThunk
    if (typeof node === "function") {
        const thunk = node;
        const slotAnchor = (0, convert_1.makeSlotAnchor)(ctx.anchor, nodePath);
        return thunk({
            template: ctx,
            slotPath: nodePath,
            slotAnchor
        });
    }
    // Array
    if (Array.isArray(node)) {
        const out = [];
        for (let i = 0; i < node.length; i++) {
            const child = node[i];
            // descend into array element context using ARRAY_SEG
            const childPath = (0, convert_1.slotPathPushArray)(nodePath);
            out[i] = resolveTemplateNode(child, ctx, childPath);
        }
        return out;
    }
    // Object
    if (isJsonObject(node)) {
        const out = {};
        for (const [k, child] of Object.entries(node)) {
            const childPath = (0, brands_1.asSlotPath)([...(0, brands_1.unwrapSlotPath)(nodePath), k]);
            out[k] = resolveTemplateNode(child, ctx, childPath);
        }
        return out;
    }
    // Primitive
    return node;
}
/* ============================================================
 * render() with array contributor templates
 * ============================================================ */
function render(templateIds, args) {
    const cfg = (0, config_1.getConfig)();
    const templateRootAbs = (0, brands_1.asTemplateDirAbs)(path.resolve(cfg.templateDir));
    const out = {};
    for (const tidRaw of templateIds) {
        const tid = (0, convert_1.toTemplateId)(tidRaw);
        const tidPath = (0, convert_1.parseTemplateIdPath)(tid);
        const { dir: dirSegs, tag } = (0, convert_1.splitTemplateIdPath)(tidPath);
        // Retrieve template impl from root by logical path
        const tPathRel = (0, brands_1.asFsRelPath)([...dirSegs, tag]);
        const [impl, implAbs] = retrieveTemplate(tPathRel, templateRootAbs);
        // Determine mount anchor + whether this is an array contributor
        const mountAnchor = (0, convert_1.deriveMountAnchor)(dirSegs, cfg); // keys only
        const { isArrayContributor, pushDepth } = (0, convert_1.deriveArrayContribution)(dirSegs, cfg);
        // Build TemplateContext for this root template
        const ctx = {
            id: tid,
            anchor: mountAnchor,
            templateDir: templateRootAbs,
            path: (0, brands_1.asFsRelPath)(dirSegs),
            filename: path.basename(implAbs)
        };
        // Resolve template to value
        let val;
        if (isTemplateFunction(impl)) {
            const tools = { apply: exports.apply };
            const node = impl(args, ctx, tools);
            val = resolveTemplateNode(node, ctx, (0, brands_1.asSlotPath)([]));
        }
        else {
            val = impl;
        }
        // Apply into output
        if (!isArrayContributor) {
            // Normal object mount: merge/replace at mountAnchor
            const keys = (0, brands_1.unwrapObjPath)(mountAnchor);
            // root anchored object: merge at top
            if (keys.length === 0) {
                if (!isJsonObject(val)) {
                    throw new Error(`invalid-anchor: root template must return object: ${tidRaw}`);
                }
                const merged = deepMergeObjects(out, val);
                Object.assign(out, merged);
                continue;
            }
            // descend and set/merge at last key
            let cur = out;
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const isLast = i === keys.length - 1;
                if (isLast) {
                    const existing = cur[k];
                    if (isJsonObject(existing) && isJsonObject(val)) {
                        cur[k] = deepMergeObjects(existing, val);
                    }
                    else {
                        cur[k] = val;
                    }
                }
                else {
                    const existing = cur[k];
                    if (!isJsonObject(existing))
                        cur[k] = {};
                    cur = cur[k];
                }
            }
            continue;
        }
        // Array contributor:
        // - mountAnchor determines the array property (keys-only)
        // - pushDepth determines wrapping:
        //    depth=1 => push(val)
        //    depth=2 => push([val])
        //    depth=3 => push([[val]]), etc.
        {
            const keys = (0, brands_1.unwrapObjPath)(mountAnchor);
            if (keys.length === 0) {
                throw new Error(`type-mismatch: cannot use [] contributor at root: ${tidRaw}`);
            }
            let cur = out;
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const isLast = i === keys.length - 1;
                if (!isLast) {
                    const existing = cur[k];
                    if (!isJsonObject(existing))
                        cur[k] = {};
                    cur = cur[k];
                    continue;
                }
                // last: this is the array field
                const existing = cur[k];
                if (existing === undefined) {
                    cur[k] = [];
                }
                else if (!Array.isArray(existing)) {
                    throw new Error(`append-type-mismatch: '${keys.join("/")}' is not an array but template '${tidRaw}' is an array contributor`);
                }
                let pushed = val;
                for (let d = 1; d < pushDepth; d++) {
                    pushed = [pushed];
                }
                cur[k].push(pushed);
            }
        }
    }
    return out;
}
