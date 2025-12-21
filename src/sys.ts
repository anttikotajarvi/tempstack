// src/sys.ts
import * as fs from "node:fs";
import * as path from "node:path";

import type {
  Config,
  JsonArray,
  JsonObject,
  JsonValue,
  TemplateFunction,
  TemplateLiteral,
  TemplateNode,
  TemplateContext,
  TemplateTools,
  ApplyThunk,
} from "./types/new-index";

import { ARRAY_SEG, asFsFilename, isArraySeg } from "./types/brands";

import {
  asTemplateId,
  asTemplateDirAbs,
  asFsAbsPath,
  asFsRelPath,
  asTemplateTagName,
  asTemplateAnchorPath,
  unwrapTemplateId,
  unwrapFsAbsPath,
  unwrapFsRelPath,
  TemplateDirAbs,
  FsAbsPath,
  FsRelPath,
  TemplateTagName,
  SlotPath,
  TemplateAnchorPath,
  TemplateId,
} from "./types/brands";

import {
  setErr,
  parseTemplateIdPath,
  splitTemplateIdPath,
  deriveMountAnchor,
  deriveArrayContribution,
  slotPathPushKey,
  slotPathPushArray,
  parseApplySelector,
  buildApplyTPath,
  deriveCallerDirAbs,
  absFromTemplateDir,
  makeSlotAnchor,
} from "./types/convert";

import {
  groupAgnosticFind,
  literalFilename,
  templateFilename,
  tagNameFromFilename,
} from "./filesystem";

import { getConfig } from "./config";

/* ============================================================
 * Errors
 * ============================================================ */

export enum ERROR_CODES {
  INVALID_TEMPLATE_ID = "invalid-template-id",
  NO_EXPLICIT_FILE_TYPES = "no-explicit-file-types",
  NO_DUPLICATE_TEMPLATES = "no-duplicate-templates",
  TEMPLATE_NOT_FOUND = "template-not-found",
  AMBIGIGUOUS_TEMPLATE_NAME = "ambiguous-template-name",
  INVALID_TEMPLATE_TYPE = "invalid-template-type",
  INVALID_TEMPLATE_ARGS = "invalid-template-args",
  TEMPLATE_EXECUTION_ERROR = "template-execution-error",
  INVALID_ANCHOR = "invalid-anchor",
  ARRAY_TYPE_MISMATCH = "array-type-mismatch",
  UNEXPECTED_READ_ERROR = "unexpected-read-error",
}

const error =
  (processName: string) =>
  (code: ERROR_CODES | string, msg: any, err?: any): never => {
    throw new Error(`${code} from ${processName}: ${msg}`);
  };

// Wire convert.ts errors into our error style
setErr((code, msg) => {
  throw new Error(`${code}: ${msg}`);
});

/* ============================================================
 * Small JSON helpers
 * ============================================================ */

const isJsonObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const deepMergeObjects = (a: JsonObject, b: JsonObject): JsonObject => {
  const out: JsonObject = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (isJsonObject(cur) && isJsonObject(v)) {
      out[k] = deepMergeObjects(cur, v);
    } else {
      out[k] = v as JsonValue;
    }
  }
  return out;
};

/* ============================================================
 * File readers (strict)
 * ============================================================ */

const readLiteralFile = (absPath: FsAbsPath): TemplateLiteral => {
  const E = error("READ_LITERAL");
  const raw = fs.readFileSync(unwrapFsAbsPath(absPath), "utf8");

  try {
    return JSON.parse(raw) as JsonValue;
  } catch (err) {
    return E(
      ERROR_CODES.UNEXPECTED_READ_ERROR,
      `invalid-json in file: ${unwrapFsAbsPath(absPath)} (raw length=${
        raw.length
      })`,
      err
    );
  }
};

const readTemplateFile = (absPath: FsAbsPath): TemplateFunction => {
  const E = error("READ_TEMPLATE_FILE");
  const absStr = unwrapFsAbsPath(absPath);

  try {
    // Ensure Node loads fresh version in tests
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    delete (require as any).cache?.[require.resolve(absStr)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(absStr);
    const fn = (mod?.default ?? mod?.module?.exports ?? mod) as unknown;

    if (typeof fn !== "function") {
      return E(
        ERROR_CODES.INVALID_TEMPLATE_TYPE,
        `Template JS did not export a function: ${absStr}`
      );
    }
    return fn as TemplateFunction;
  } catch (err) {
    return E(
      ERROR_CODES.UNEXPECTED_READ_ERROR,
      `Error requiring template file: ${absStr}`,
      err
    );
  }
};

const isTemplateFunction = (
  v: TemplateFunction | TemplateLiteral
): v is TemplateFunction => typeof v === "function";

const isTemplateLiteral = (
  v: TemplateFunction | TemplateLiteral
): v is TemplateLiteral => !isTemplateFunction(v);

/* ============================================================
 * retrieveTemplate (strict)
 * ============================================================ */

export function retrieveTemplate(
  tPath: FsRelPath,
  rootDirAbs: TemplateDirAbs | FsAbsPath,
  cfg: Config
): [template: TemplateFunction | TemplateLiteral, absolutePath: FsAbsPath] {
  const E = error("READ_TEMPLATE");

  const segs = unwrapFsRelPath(tPath);
  if (segs.length === 0) {
    return E(ERROR_CODES.INVALID_TEMPLATE_ID, "Empty template path");
  }

  const dirSegs = segs.slice(0, -1);
  const tagRaw = segs[segs.length - 1];

  // [RULE] no-explicit-file-types
  if (tagRaw.endsWith(cfg.LITERAL_EXT) || tagRaw.endsWith(cfg.TEMPLATE_EXT)) {
    return E(
      ERROR_CODES.NO_EXPLICIT_FILE_TYPES,
      `Template tag name must not include file extension: ${tagRaw}`
    );
  }

  const tagName: TemplateTagName = asTemplateTagName(tagRaw);

  // Build exact literal and fn absolute paths
  const rootAbsStr = unwrapFsAbsPath(rootDirAbs as TemplateDirAbs);
  const literalAbs: FsAbsPath = asFsAbsPath(
    path.join(
      rootAbsStr,
      ...dirSegs,
      literalFilename(tagName, cfg) as unknown as string
    )
  );
  const fnAbs: FsAbsPath = asFsAbsPath(
    path.join(
      rootAbsStr,
      ...dirSegs,
      templateFilename(tagName, cfg) as unknown as string
    )
  );

  const templateExists = fs.existsSync(unwrapFsAbsPath(fnAbs));
  const literalExists = fs.existsSync(unwrapFsAbsPath(literalAbs));

  // [RULE] no-duplicate-templates
  if (literalExists && templateExists) {
    return E(
      ERROR_CODES.NO_DUPLICATE_TEMPLATES,
      `Template tag resolves to both literal and function: ${tagRaw}`
    );
  }

  if (templateExists) return [readTemplateFile(fnAbs), fnAbs];
  if (literalExists) return [readLiteralFile(literalAbs), literalAbs];

  // Shorthand (implicit group traversal)
  {
    // filesystem.ts currently expects TemplateDirAbs; allow arbitrary roots by branding
    const brandedRoot = asTemplateDirAbs(rootAbsStr);

    const hits = groupAgnosticFind(
      brandedRoot,
      asFsRelPath(dirSegs),
      tagName,
      cfg
    );

    if (hits.length === 0) {
      return E(
        ERROR_CODES.TEMPLATE_NOT_FOUND,
        `Template not found: ${segs.join("/")}`
      );
    }
    if (hits.length > 1) {
      return E(
        ERROR_CODES.AMBIGIGUOUS_TEMPLATE_NAME,
        `Multiple matches for template: ${segs.join("/")} -> ${JSON.stringify(
          hits.map(unwrapFsRelPath),
          null,
          2
        )}`
      );
    }

    const relHit = hits[0];
    const absHit = absFromTemplateDir(brandedRoot, relHit);

    const absHitStr = unwrapFsAbsPath(absHit);
    if (absHitStr.endsWith(cfg.TEMPLATE_EXT))
      return [readTemplateFile(absHit), absHit];
    if (absHitStr.endsWith(cfg.LITERAL_EXT))
      return [readLiteralFile(absHit), absHit];

    return E(
      ERROR_CODES.UNEXPECTED_READ_ERROR,
      `Unrecognized extension for implicit hit: ${absHitStr}`
    );
  }
}

/* ============================================================
 * apply() (strict + array semantics via slotPath)
 * ============================================================ */

export const apply =
  (tagName: string, args: Record<string, unknown> = {}): ApplyThunk =>
  (slotCtx) => {
    const E = error("APPLY_THUNK_EXECUTION");
    const cfg = getConfig();

    const caller = slotCtx.template;

    // group::tag parsing (group dirs ONLY use cfg.groupDirPrefix)
    const selector = parseApplySelector(tagName, cfg);

    // Build relative tPath: slotPath + [groupDir?] + tag
    const tPath = buildApplyTPath(slotCtx.slotPath, selector);

    // Root for resolution is caller directory on disk
    const callerDirAbs = deriveCallerDirAbs(
      caller.templateDir,
      unwrapFsRelPath(caller.path)
    );

    const [impl, implAbs] = retrieveTemplate(tPath, callerDirAbs, cfg);

    if (isTemplateLiteral(impl)) {
      if (Object.keys(args).length > 0) {
        return E(
          ERROR_CODES.INVALID_TEMPLATE_ARGS,
          `Literal template but apply() received args: ${tagName}`
        );
      }
      return impl as TemplateLiteral;
    }

    if (!isTemplateFunction(impl)) {
      return E(
        ERROR_CODES.INVALID_TEMPLATE_TYPE,
        `Template is neither literal nor function: ${tagName}`
      );
    }

    const fn = impl as TemplateFunction;

    // slotPath: path inside caller's returned node (may include "[]")
    // slotAnchor: absolute logical path (caller.anchor + slotPath) (may include "[]")
    const slotPathSegs: string[] = slotCtx.slotPath.map((s) => String(s));
    const slotAnchorSegs: string[] = slotCtx.slotAnchor.map((s) => String(s));

    // TemplateContext.anchor is keys-only (object structure mount), so remove ARRAY_SEG
    const anchorKeysOnly: string[] = slotAnchorSegs.filter(
      (s) => s !== ARRAY_SEG
    );

    // TemplateContext.path is filesystem-relative dir to the template directory.
    // This *can* include "[]" because you literally have a directory named "[]".
    const subPathSegs: string[] = [
      ...unwrapFsRelPath(caller.path),
      ...slotPathSegs,
      ...(selector.kind === "grouped" ? [String(selector.groupDir)] : []),
    ];

    const subCtx: TemplateContext = {
      id: asTemplateId(tagName),
      anchor: asTemplateAnchorPath(anchorKeysOnly),
      templateDir: caller.templateDir,
      path: asFsRelPath(subPathSegs),
      filename: asFsFilename(path.basename(unwrapFsAbsPath(implAbs))),
    };

    const tools: TemplateTools = { apply };

    const node = fn(args, subCtx, tools) as TemplateNode;
    return resolveTemplateNode(node, subCtx, asFsRelPath([]));
  };

/* ============================================================
 * resolveTemplateNode (ARRAY FIX: uses [] instead of indices)
 * ============================================================ */

export function resolveTemplateNode(
  node: TemplateNode,
  ctx: TemplateContext,
  nodePath: FsRelPath // path inside this template's returned node, as segments
): JsonValue {
  const E = error("RESOLVE_TEMPLATE_NODE");

  // ApplyThunk
  if (typeof node === "function") {
    const thunk = node as ApplyThunk;

    // IMPORTANT ARRAY SEMANTICS:
    // nodePath is already a SlotPath-like sequence, where array descent uses ARRAY_SEG.
    const slotPath = nodePath as unknown as SlotPath;
    const slotAnchor = makeSlotAnchor(ctx.anchor, slotPath);

    try {
      return thunk({
        template: ctx,
        slotPath,
        slotAnchor,
      });
    } catch (err) {
      return E(ERROR_CODES.TEMPLATE_EXECUTION_ERROR, err);
    }
  }

  // Array branch: descend with ARRAY_SEG (NOT indices)
  if (Array.isArray(node)) {
    const out: JsonArray = [];
    for (let i = 0; i < node.length; i++) {
      const child = node[i] as TemplateNode;

      const nextPath = slotPathPushArray(nodePath as unknown as SlotPath);
      out[i] = resolveTemplateNode(
        child,
        ctx,
        nextPath as unknown as FsRelPath
      );
    }
    return out;
  }

  // Object branch
  if (isJsonObject(node as JsonObject)) {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(node as JsonObject)) {
      const nextPath = slotPathPushKey(nodePath as unknown as SlotPath, key);
      out[key] = resolveTemplateNode(
        child as TemplateNode,
        ctx,
        nextPath as unknown as FsRelPath
      );
    }
    return out;
  }

  // Primitive JsonValue
  return node as JsonValue;
}

/* ============================================================
 * render() (implements [] anchor semantics)
 * ============================================================ */

export function render(
  templateIds: string[],
  args: Record<string, unknown>
): JsonObject {
  const E = error("RENDER_TEMPLATES");
  const cfg = getConfig();

  const out: JsonObject = {};

  for (const tidRaw of templateIds) {
    const tid: TemplateId = asTemplateId(tidRaw);
    const idPath = parseTemplateIdPath(tid);
    const { dir, tag } = splitTemplateIdPath(idPath);

    // Full filesystem rel path to the template (dir + tag)
    const fullRel = asFsRelPath([...dir, tag as unknown as string]);

    const [impl, implAbs] = retrieveTemplate(
      fullRel,
      cfg.templateDir as unknown as TemplateDirAbs,
      cfg
    );

    const mountAnchor: TemplateAnchorPath = deriveMountAnchor(dir, cfg);
    const { isArrayContributor, pushDepth } = deriveArrayContribution(dir, cfg);

    let node: TemplateNode;
    if (isTemplateFunction(impl)) {
      const fn = impl as TemplateFunction;

      const ctx: TemplateContext = {
        id: tid,
        anchor: mountAnchor,
        templateDir: cfg.templateDir as unknown as TemplateDirAbs,
        path: asFsRelPath(dir),
        filename: path.basename(unwrapFsAbsPath(implAbs)),
      };

      const tools: TemplateTools = { apply };

      try {
        node = fn(args, ctx, tools) as TemplateNode;
      } catch (err) {
        return E(
          ERROR_CODES.TEMPLATE_EXECUTION_ERROR,
          `Error executing template function '${unwrapTemplateId(tid)}': ${
            (err as Error).message
          }`,
          err
        );
      }

      const val = resolveTemplateNode(node, ctx, asFsRelPath([]));

      if (isArrayContributor) {
        pushIntoArrayAtAnchor(out, mountAnchor, val, pushDepth);
      } else {
        mergeAtAnchor(out, mountAnchor, val);
      }
    } else {
      const val = impl as TemplateLiteral;

      if (isArrayContributor) {
        pushIntoArrayAtAnchor(out, mountAnchor, val, pushDepth);
      } else {
        mergeAtAnchor(out, mountAnchor, val);
      }
    }
  }

  return out;
}

function mergeAtAnchor(
  out: JsonObject,
  anchor: TemplateAnchorPath,
  val: JsonValue
): void {
  const E = error("MERGE_AT_ANCHOR");
  const segs = unwrapFsRelPath(anchor as unknown as FsRelPath);

  if (segs.length === 0) {
    if (isJsonObject(val)) {
      Object.assign(out, deepMergeObjects(out, val));
      return;
    }
    E(
      ERROR_CODES.INVALID_ANCHOR,
      `Root-anchored template must return an object`
    );
  }

  let cur: JsonObject = out;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const isLast = i === segs.length - 1;

    if (isLast) {
      const existing = cur[seg];
      if (isJsonObject(existing) && isJsonObject(val)) {
        cur[seg] = deepMergeObjects(existing, val);
      } else {
        cur[seg] = val;
      }
    } else {
      const existing = cur[seg];
      if (!isJsonObject(existing)) cur[seg] = {};
      cur = cur[seg] as JsonObject;
    }
  }
}

function pushIntoArrayAtAnchor(
  out: JsonObject,
  anchor: TemplateAnchorPath,
  val: JsonValue,
  pushDepth: number
): void {
  const E = error("PUSH_INTO_ARRAY");
  const segs = unwrapFsRelPath(anchor as unknown as FsRelPath);

  // Wrap val for nested-array contributions: depth=1 => val, depth=2 => [val], depth=3 => [[val]], ...
  const wrapped = wrapForDepth(val, pushDepth);

  // Root anchor array
  if (segs.length === 0) {
    if (!Array.isArray(out as any)) {
      // out is an object by design; root-level [] contributors are nonsensical in this system
      E(
        ERROR_CODES.ARRAY_TYPE_MISMATCH,
        `Root '[]' contributor is not supported`
      );
    }
    return;
  }

  let cur: JsonObject = out;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const isLast = i === segs.length - 1;

    if (isLast) {
      const existing = cur[seg];

      if (existing === undefined) {
        cur[seg] = [];
      } else if (!Array.isArray(existing)) {
        E(
          ERROR_CODES.ARRAY_TYPE_MISMATCH,
          `Cannot push into non-array at '${segs.join("/")}'`
        );
      }

      (cur[seg] as unknown as JsonArray).push(wrapped);
    } else {
      const existing = cur[seg];
      if (!isJsonObject(existing)) cur[seg] = {};
      cur = cur[seg] as JsonObject;
    }
  }
}

function wrapForDepth(val: JsonValue, pushDepth: number): JsonValue {
  // pushDepth=1 => val
  // pushDepth=2 => [val]
  // pushDepth=3 => [[val]]
  let out: JsonValue = val;
  for (let i = 1; i < pushDepth; i++) {
    out = [out] as unknown as JsonArray;
  }
  return out;
}
