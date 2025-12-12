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
exports.retrieveTemplate = retrieveTemplate;
exports.resolveTemplateNode = resolveTemplateNode;
exports.render = render;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
var ERROR_CODES;
(function (ERROR_CODES) {
    ERROR_CODES["NO_EXPLICIT_FILE_TYPES"] = "no-explicit-file-types";
    ERROR_CODES["NO_DUPLICATE_TEMPLATES"] = "no-duplicate-templates";
    ERROR_CODES["TEMPLATE_NOT_FOUND"] = "template-not-found";
    ERROR_CODES["UNEXPECTED_READ_ERROR"] = "unexpected-read-error";
    ERROR_CODES["UNEXPECTED_REQUIRE_ERROR"] = "unexpected-require-error";
    ERROR_CODES["UNCAUGHT_EXCEPTION"] = "uncaught-exception";
    ERROR_CODES["AMBIGIOUS_TEMPLATE_NAME"] = "ambigious-template-name";
    ERROR_CODES["TEMPLATE_EXECUTION_ERROR"] = "template-execution-error";
    ERROR_CODES["INVALID_TEMPLATE_TYPE"] = "invalid-template-type";
    ERROR_CODES["INVALID_ANCHOR"] = "invalid-anchor";
    ERROR_CODES["INVALID_TEMPLATE_ID"] = "invalid-template-id";
    ERROR_CODES["INVALID_TEMPLATE_ARGS"] = "invalid-template-args";
    ERROR_CODES["INVALID_BASE_TEMPLATE"] = "invalid-base-template";
})(ERROR_CODES || (ERROR_CODES = {}));
const filesystem_1 = require("./filesystem");
const types_1 = require("./types");
const util_1 = require("./util");
const groupAgnosticFind = (0, filesystem_1.groupAgnosticFindWithFs)(fs);
const error = (processName) => (code, msg) => {
    throw new Error(`${code} from ${processName}: ${msg}`);
};
function readLiteralFile(file) {
    const E = error("READ_LITERAL");
    try {
        const content = fs.readFileSync(file, "utf-8");
        return JSON.parse(content);
    }
    catch (err) {
        return E(ERROR_CODES.UNEXPECTED_READ_ERROR, `Error reading or parsing file: ${file}`);
    }
}
function readTemplateFile(file) {
    const E = error("READ_TEMPLATE_FILE");
    try {
        const fn = require(file);
        return fn;
    }
    catch (err) {
        return E(ERROR_CODES.UNEXPECTED_REQUIRE_ERROR, `Error importing file: ${file}`);
    }
}
function retrieveTemplate(tPath, root) {
    const E = error("READ_TEMPLATE_LITERAL");
    const cfg = (0, config_1.getConfig)();
    const dirPath = tPath.slice(0, -1);
    const tagName = tPath[tPath.length - 1];
    // [RULE] no-explicit-file-types
    if (tagName.endsWith(cfg.LITERAL_EXT) || tagName.endsWith(cfg.TEMPLATE_EXT)) {
        E(ERROR_CODES.NO_EXPLICIT_FILE_TYPES, `Template tag name must not include file extension: ${tagName}`);
    }
    const literalPathAbs = path.join(root, ...dirPath, (0, filesystem_1.literalFilename)(tagName));
    const templatePathAbs = path.join(root, ...dirPath, (0, filesystem_1.templateFilename)(tagName));
    const templateExists = fs.existsSync(templatePathAbs);
    const literalExists = fs.existsSync(literalPathAbs);
    // [RULE] no-duplicate-templates
    if (literalExists && templateExists) {
        return E(ERROR_CODES.NO_DUPLICATE_TEMPLATES, `Template tag name resolves to both literal and function template: ${tagName}`);
    }
    // Optimistic checks
    if (templateExists) {
        // Function template
        return [readTemplateFile(templatePathAbs), templatePathAbs];
    }
    if (literalExists) {
        // Literal template
        return [readLiteralFile(literalPathAbs), literalPathAbs];
    }
    /* Neither found, either it doesnt exist or is shorthand notation which only implies groups */
    // Check for shorthand group notation
    {
        const groupHits = groupAgnosticFind(dirPath, tagName, cfg);
        if (groupHits.length === 0) {
            // not found at all → error
            return E(ERROR_CODES.TEMPLATE_NOT_FOUND, `Template not found: ${[...dirPath, tagName].join("/")}`);
        }
        else if (groupHits.length === 1) {
            // unique implicit group: load that file (json/js) and return it
            const filepathAbs = path.join(root, ...groupHits[0]);
            if (filepathAbs.endsWith(cfg.TEMPLATE_EXT))
                return [readTemplateFile(filepathAbs), filepathAbs];
            if (filepathAbs.endsWith(cfg.LITERAL_EXT))
                return [readLiteralFile(filepathAbs), filepathAbs];
            return E(ERROR_CODES.UNCAUGHT_EXCEPTION, `Unrecognized extension from a shorthand call: ${filepathAbs}`);
        }
        else {
            // >1 -> shorthand is ambiguous -> error, tell user to specify group explicitly
            return E(ERROR_CODES.AMBIGIOUS_TEMPLATE_NAME, `Multiple matches for template ID: '${path.join(...tPath)}' in ${JSON.stringify(groupHits, null, 2)}`);
        }
    }
}
const apply = (tagName, args = {}) => {
    const E = error("APPLY_THUNK_EXECUTION");
    const cfg = (0, config_1.getConfig)();
    // Parse optional group syntax: "group::tag"
    let baseTag = tagName;
    let groupDir = null;
    const sepIdx = tagName.indexOf("::");
    if (sepIdx !== -1) {
        const groupName = tagName.slice(0, sepIdx).trim();
        const tagPart = tagName.slice(2 + sepIdx).trim();
        if (!groupName || !tagPart) {
            return E(ERROR_CODES.INVALID_TEMPLATE_ID, `Invalid group selector syntax in apply(): '${tagName}'`);
        }
        baseTag = tagPart;
        // Only groupDirPrefix, NOT hidden prefix
        groupDir = cfg.groupDirPrefix + groupName;
    }
    const thunk = (slotCtx) => {
        const { template: caller, slotPath, slotAnchor } = slotCtx;
        if (!caller.templateDir) {
            return E(ERROR_CODES.UNCAUGHT_EXCEPTION, `Invalid TemplateContext for apply('${tagName}') in ${caller.id}`);
        }
        // Build template path RELATIVE to the caller's directory:
        //   slotPath + [groupDir?] + baseTag
        //
        // Example at root:
        //   nodePath / slotPath = ["style","color"]
        //   apply("red")
        //   => tPath = ["style","color","red"]
        //
        // Example with group:
        //   apply("dark::red")
        //   => tPath = ["style","color",".dark","red"]
        const dirSegments = [...slotPath]; // e.g. ["style","color"]
        if (groupDir) {
            dirSegments.push(groupDir);
        }
        const tPath = [...dirSegments, baseTag];
        // Root dir for this resolution is the caller's directory on disk
        const callerDirAbs = path.join(caller.templateDir, ...caller.path);
        const [templateImpl, templatePathAbs] = retrieveTemplate(tPath, callerDirAbs);
        // --- Literal template case ---
        if ((0, types_1.isTemplateLiteral)(templateImpl)) {
            if (Object.keys(args).length > 0) {
                return E(ERROR_CODES.INVALID_TEMPLATE_ARGS, `Template '${tPath.join("/")}' is literal but apply() was given arguments: ${JSON.stringify(args)}`);
            }
            return templateImpl;
        }
        // --- Function template case ---
        if (!(0, types_1.isTemplateFunction)(templateImpl)) {
            return E(ERROR_CODES.INVALID_TEMPLATE_TYPE, `Template '${tPath.join("/")}' is neither literal nor function in apply('${tagName}')`);
        }
        const fn = templateImpl;
        // Build TemplateContext for the subtemplate
        // Path of the subtemplate dir is caller.path + dirSegments
        const subPath = [...caller.path, ...dirSegments];
        const subCtx = {
            id: tPath.join("/"), // you can refine this if you like
            anchor: slotAnchor, // subtemplate anchors exactly at this slot
            templateDir: caller.templateDir,
            path: subPath,
            filename: path.basename(templatePathAbs)
        };
        const subTools = { apply };
        const resultNode = fn(args, subCtx, subTools);
        // Resolve nested applies within the subtemplate
        return resolveTemplateNode(resultNode, subCtx, []);
    };
    return thunk;
};
function resolveTemplateNode(node, ctx, nodePath // path inside this template's result
) {
    //const E = error("RESOLVE_TEMPLATE_NODE");
    // ApplyThunk
    if (typeof node === "function") {
        const thunk = node;
        const slotAnchor = [...ctx.anchor, ...nodePath];
        return thunk({
            template: ctx,
            slotPath: nodePath,
            slotAnchor
        });
    }
    // Array branch
    if (Array.isArray(node)) {
        const out = [];
        for (let i = 0; i < node.length; i++) {
            const child = node[i];
            out[i] = resolveTemplateNode(child, ctx, [...nodePath, String(i)]);
        }
        return out;
    }
    // Object branch
    if ((0, util_1.isJsonObject)(node)) {
        const out = {};
        for (const [key, child] of Object.entries(node)) {
            out[key] = resolveTemplateNode(child, ctx, [
                ...nodePath,
                key
            ]);
        }
        return out;
    }
    // Primitive JsonValue
    return node;
}
// cfg.groupDirPrefix + HIDDEN_FILE_PREFIX assumed in scope
// splitPath, retrieveTemplate, error, ERROR_CODES assumed in scope
function render(templateIds, args) {
    const E = error("RENDER_TEMPLATES");
    const cfg = (0, config_1.getConfig)();
    // --- Seed output with base.json if present ---
    let out = {};
    // --- Apply each top-level template id in order ---
    for (const tid of templateIds) {
        const tPath = (0, util_1.splitPath)(tid); // e.g. ["render", ".a", "look", "main"]
        if (tPath.length === 0) {
            return E(ERROR_CODES.INVALID_TEMPLATE_ID, `Empty template ID in render(): '${tid}'`);
        }
        // Directory segments (relative to templateDir), including groups
        const dirPath = tPath.slice(0, -1); // ["render",".a","look"]
        // Logical anchor path: drop group/hidden dirs
        const anchorSegments = dirPath.filter((seg) => !seg.startsWith(cfg.groupDirPrefix) &&
            !seg.startsWith(filesystem_1.HIDDEN_FILE_PREFIX));
        // Load template implementation and its absolute filepath
        const [templateImpl, templatePathAbs] = retrieveTemplate(tPath, cfg.templateDir);
        let val;
        if ((0, types_1.isTemplateFunction)(templateImpl)) {
            const fn = templateImpl;
            const ctx = {
                id: tid,
                anchor: anchorSegments,
                templateDir: cfg.templateDir,
                path: dirPath,
                filename: path.basename(templatePathAbs)
            };
            const tools = { apply };
            let node;
            try {
                node = fn(args, ctx, tools);
                // Collapse all ApplyThunks to a pure JsonValue tree
            }
            catch (err) {
                return E(ERROR_CODES.TEMPLATE_EXECUTION_ERROR, `Error executing template function '${tid}': ${err.message}`);
            }
            val = resolveTemplateNode(node, ctx, []);
        }
        else {
            // Literal template: already a pure JsonValue
            val = templateImpl;
        }
        // --- Merge `val` into `out` at the logical anchor ---
        // Root-anchored template
        if (anchorSegments.length === 0) {
            if (!(0, util_1.isJsonObject)(val)) {
                return E(ERROR_CODES.INVALID_ANCHOR, `Root-anchored template must return an object: ${tid}`);
            }
            const merged = (0, util_1.deepMergeObjects)(out, val);
            Object.assign(out, merged);
            continue;
        }
        // Non-root anchor
        let cur = out;
        anchorSegments.forEach((seg, idx) => {
            const isLast = idx === anchorSegments.length - 1;
            if (isLast) {
                const existing = cur[seg];
                if ((0, util_1.isJsonObject)(existing) && (0, util_1.isJsonObject)(val)) {
                    cur[seg] = (0, util_1.deepMergeObjects)(existing, val);
                }
                else {
                    cur[seg] = val;
                }
            }
            else {
                const existing = cur[seg];
                if (!(0, util_1.isJsonObject)(existing)) {
                    cur[seg] = {};
                }
                cur = cur[seg];
            }
        });
    }
    return out;
}
