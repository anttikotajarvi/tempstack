import fs from "node:fs";
import path from "node:path";

import {
  Config,
  JsonValue,
  TemplateContext,
  TemplateFunction,
  TemplateTools
} from "../types/index";
import {
  TemplateTreeRep,
  TTDir,
  TTDirType,
  TTFunctionLog,
  TTLiteralLog
} from "../types/report";
import { HIDDEN_FILE_PREFIX } from "../filesystem";
import { ARRAY_SEG } from "../types/brands";

// ----------------- helpers -----------------

function classifyDirType(name: string, cfg: Config): TTDirType {
  if (name === "") return "root";
  if (name === ARRAY_SEG) return "array-dir";
  if (name.startsWith(cfg.groupDirPrefix)) return "group-dir";
  if (name.startsWith(HIDDEN_FILE_PREFIX)) return "hidden-dir";
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
function computeAnchor(localPath: string[], cfg: Config): string[] {
  if (localPath.length === 0) return [];
  const withoutLast = localPath.slice(0, -1);

  return withoutLast.filter((seg) => {
    if (seg === ARRAY_SEG) return false;
    if (seg.startsWith(cfg.groupDirPrefix)) return false;
    if (seg.startsWith(HIDDEN_FILE_PREFIX)) return false;
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
function computeIsArrayContributor(fileLocalPath: string[]): boolean {
  // Exclude basename
  const parentSegs = fileLocalPath.slice(0, -1);
  return parentSegs.includes(ARRAY_SEG);
}

/**
 * Heuristic: run the template with a proxy args object that records accessed keys.
 */
export function getUsedArguments(tFn: TemplateFunction): string[] {
  const accessedArgs = new Set<string>();

  const proxyArgs: any = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (typeof prop === "string") accessedArgs.add(prop);
        // return proxy itself so conditionals and chained access still run
        return proxyArgs;
      }
    }
  );

  const dummyCtx = {
    id: "audit-template",
    anchor: [],
    templateDir: "",
    path: [],
    filename: ""
  } as any as TemplateContext;

  const dummyTools: TemplateTools = {
    apply: () => () => null as any
  };

  try {
    tFn(proxyArgs, dummyCtx, dummyTools);
  } catch {
    // ignore errors during audit
  }

  return Array.from(accessedArgs);
}

/**
 * Simple heuristic to check if a template uses apply().
 * You can make this smarter later (AST, etc).
 */
function detectUsesApply(fnSrc: string): boolean {
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
function buildDirNode(
  cfg: Config,
  name: string,
  parentLocalPath: string[],
  parentFsPath: string
): TTDir {
  const localPath = name === "" ? [] : [...parentLocalPath, name];
  const fsPath = name === "" ? parentFsPath : path.join(parentFsPath, name);

  const dirType: TTDirType = classifyDirType(name, cfg);

  // Only anchor dirs contribute to logical anchors. Groups/hidden/array do not.
  const dirAnchor: string[] = dirType === "anchor-dir" ? [name] : [];

  const node: TTDir = {
    nodeType: "dir",
    name,
    localPath,
    fsPath,
    dirType,
    dirAnchor,
    children: {}
  };

  const entries = fs.readdirSync(fsPath, { withFileTypes: true });

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

    if (!entry.isFile()) continue;

    const ext = path.extname(entryName); // ".json" / ".js"
    const baseName = path.basename(entryName, ext); // "layout", "site", "primary"...
    const fileLocalPath = [...localPath, baseName]; // without extension
    const fileFsPath = path.join(fsPath, entryName);

    if (ext === cfg.LITERAL_EXT) {
      const raw = fs.readFileSync(fileFsPath, "utf8");
      const content = JSON.parse(raw) as JsonValue;
      const anchor = computeAnchor(fileLocalPath, cfg);
      const isArrayContributor = computeIsArrayContributor(fileLocalPath);

      const litNode: TTLiteralLog = {
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
        throw new Error(
          `Duplicate child entry '${entryName}' under ${fsPath} (file: ${entryName})`
        );
      }

      node.children[entryName] = litNode;
      continue;
    }

    if (ext === cfg.TEMPLATE_EXT) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(fileFsPath);
      const tFn: TemplateFunction = typeof mod === "function" ? mod : mod.default;

      if (typeof tFn !== "function") {
        throw new Error(`Template file does not export a function: ${fileFsPath}`);
      }

      const fnSrc = fs.readFileSync(fileFsPath, "utf8");
      const args = getUsedArguments(tFn);
      const usesApply = detectUsesApply(fnSrc);
      const anchor = computeAnchor(fileLocalPath, cfg);
      const isArrayContributor = computeIsArrayContributor(fileLocalPath);

      const fnNode: TTFunctionLog = {
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
        throw new Error(
          `Duplicate child entry '${entryName}' under ${fsPath} (file: ${entryName})`
        );
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
export function buildTemplateTree(cfg: Config): TemplateTreeRep {
  const rootDirNode = buildDirNode(
    cfg,
    "", // root name
    [], // root localPath
    cfg.templateDir // root fsPath
  );

  return {
    cfg,
    tree: rootDirNode
  };
}
