"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsedArguments = getUsedArguments;
exports.buildTemplateTree = buildTemplateTree;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const filesystem_1 = require("../filesystem");
const brands_1 = require("../types/brands");
// ----------------- helpers -----------------
function classifyDirType(name, cfg) {
    if (name === "")
        return "root";
    if (name === brands_1.ARRAY_SEG)
        return "array-dir";
    if (name.startsWith(cfg.groupDirPrefix))
        return "group-dir";
    if (name.startsWith(filesystem_1.HIDDEN_FILE_PREFIX))
        return "hidden-dir";
    return "anchor-dir";
}
/**
 * Compute logical anchor from a file's localPath.
 * localPath e.g.
 *   ["site","style","color","primary"]
 *   ["site","style","darkColor",".dark","primary"]
 *   ["colors","[]","red"]
 *
 * anchor should be e.g.
 *   ["site","style","color"]
 *   ["site","style","darkColor"]
 *   ["colors"]
 *
 * (No groups/hidden dirs, and no ARRAY_SEG in anchors.)
 */
function computeAnchor(localPath, cfg) {
    if (localPath.length === 0)
        return [];
    const withoutLast = localPath.slice(0, -1);
    return withoutLast.filter((seg) => {
        if (seg === brands_1.ARRAY_SEG)
            return false;
        if (seg.startsWith(cfg.groupDirPrefix))
            return false;
        if (seg.startsWith(filesystem_1.HIDDEN_FILE_PREFIX))
            return false;
        return true;
    });
}
/**
 * True if a template leaf sits under an explicit ARRAY_SEG dir anywhere
 * in its parent chain.
 *
 * Examples:
 *   ["colors","red"]            -> false
 *   ["colors","[]","red"]       -> true
 *   ["nested","[]","[]","a"]    -> true
 */
function computeIsArrayContributor(fileLocalPath) {
    // Exclude basename
    const parentSegs = fileLocalPath.slice(0, -1);
    return parentSegs.includes(brands_1.ARRAY_SEG);
}
/**
 * Heuristic: run the template with a proxy args object that records accessed keys.
 */
function getUsedArguments(tFn) {
    const accessedArgs = new Set();
    const proxyArgs = new Proxy({}, {
        get(_target, prop) {
            if (typeof prop === "string")
                accessedArgs.add(prop);
            // return proxy itself so conditionals and chained access still run
            return proxyArgs;
        }
    });
    const dummyCtx = {
        id: "audit-template",
        anchor: [],
        templateDir: "",
        path: [],
        filename: ""
    };
    const dummyTools = {
        apply: () => () => null
    };
    try {
        tFn(proxyArgs, dummyCtx, dummyTools);
    }
    catch {
        // ignore errors during audit
    }
    return Array.from(accessedArgs);
}
/**
 * Simple heuristic to check if a template uses apply().
 * You can make this smarter later (AST, etc).
 */
function detectUsesApply(fnSrc) {
    return fnSrc.includes("apply(");
}
// ----------------- core builder -----------------
/**
 * Build a TTDir (and its subtree) for a given directory.
 *
 * @param cfg global config
 * @param name dir name ("", "site", ".group", "[]", etc.)
 * @param parentLocalPath e.g. [], ["site"], ...
 * @param parentFsPath absolute path to parent dir
 */
function buildDirNode(cfg, name, parentLocalPath, parentFsPath) {
    const localPath = name === "" ? [] : [...parentLocalPath, name];
    const fsPath = name === "" ? parentFsPath : node_path_1.default.join(parentFsPath, name);
    const dirType = classifyDirType(name, cfg);
    // Only anchor dirs contribute to logical anchors. Groups/hidden/array do not.
    const dirAnchor = dirType === "anchor-dir" ? [name] : [];
    const node = {
        nodeType: "dir",
        name,
        localPath,
        fsPath,
        dirType,
        dirAnchor,
        children: {}
    };
    const entries = node_fs_1.default.readdirSync(fsPath, { withFileTypes: true });
    for (const entry of entries) {
        const entryName = entry.name; // filesystem entry name, unique in this dir
        if (entry.isDirectory()) {
            const childDir = buildDirNode(cfg, entryName, localPath, fsPath);
            // Key by entryName to avoid collisions like "site" dir vs "site.js" file.
            if (node.children[entryName]) {
                throw new Error(`Duplicate child entry '${entryName}' under ${fsPath}`);
            }
            node.children[entryName] = childDir;
            continue;
        }
        if (!entry.isFile())
            continue;
        const ext = node_path_1.default.extname(entryName); // ".json" / ".js"
        const baseName = node_path_1.default.basename(entryName, ext); // "layout", "site", "primary"...
        const fileLocalPath = [...localPath, baseName]; // without extension
        const fileFsPath = node_path_1.default.join(fsPath, entryName);
        if (ext === cfg.LITERAL_EXT) {
            const raw = node_fs_1.default.readFileSync(fileFsPath, "utf8");
            const content = JSON.parse(raw);
            const anchor = computeAnchor(fileLocalPath, cfg);
            const isArrayContributor = computeIsArrayContributor(fileLocalPath);
            const litNode = {
                nodeType: "template-literal",
                name: baseName,
                localPath: fileLocalPath,
                fsPath: fileFsPath,
                anchor,
                content,
                isArrayContributor
            };
            // Key by entryName to avoid collisions with same basename but different ext.
            if (node.children[entryName]) {
                throw new Error(`Duplicate child entry '${entryName}' under ${fsPath} (file: ${entryName})`);
            }
            node.children[entryName] = litNode;
            continue;
        }
        if (ext === cfg.TEMPLATE_EXT) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require(fileFsPath);
            const tFn = typeof mod === "function" ? mod : mod.default;
            if (typeof tFn !== "function") {
                throw new Error(`Template file does not export a function: ${fileFsPath}`);
            }
            const fnSrc = node_fs_1.default.readFileSync(fileFsPath, "utf8");
            const args = getUsedArguments(tFn);
            const usesApply = detectUsesApply(fnSrc);
            const anchor = computeAnchor(fileLocalPath, cfg);
            const isArrayContributor = computeIsArrayContributor(fileLocalPath);
            const fnNode = {
                nodeType: "template-function",
                name: baseName,
                localPath: fileLocalPath,
                fsPath: fileFsPath,
                anchor,
                content: fnSrc,
                args,
                usesApply,
                isArrayContributor
            };
            if (node.children[entryName]) {
                throw new Error(`Duplicate child entry '${entryName}' under ${fsPath} (file: ${entryName})`);
            }
            node.children[entryName] = fnNode;
            continue;
        }
        // Unknown extension, ignore
    }
    return node;
}
/**
 * Public entry point: build complete TemplateTreeRep from cfg.
 */
function buildTemplateTree(cfg) {
    const rootDirNode = buildDirNode(cfg, "", // root name
    [], // root localPath
    cfg.templateDir // root fsPath
    );
    return {
        cfg,
        tree: rootDirNode
    };
}
