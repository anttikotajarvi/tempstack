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
  SlotContext,
  ApplyThunk
} from "./types/new-index";

import {
  ARRAY_SEG,
  asTemplateDirAbs,
  asTemplateId,
  asTemplateTagName,
  asFsRelPath,
  asSlotPath,
  asTemplateAnchorPath,
  toFsRelPathStr,
  toTemplateIdStr,
  toSlotAnchorStr,
  unwrapFsAbsPath,
  unwrapFsRelPath,
  unwrapSlotPath,
  unwrapObjPath,
  TemplateDirAbs,
  TemplateId,
  TemplateIdPath,
  TemplateTagName,
  FsRelPath,
  SlotPath,
  SlotAnchor,
  TemplateAnchorPath
} from "./types/brands";

import {
  // error hook
  setErr as setConvertErr,

  // parsing / derivations
  toTemplateId,
  parseTemplateIdPath,
  splitTemplateIdPath,
  deriveMountAnchor,
  deriveArrayContribution,
  parseApplySelector,
  buildApplyTPath,
  deriveCallerDirAbs,
  slotPathPushArray,
  makeSlotAnchor
} from "./types/convert";

import { groupAgnosticFind, literalFilename, templateFilename } from "./filesystem";
import { getConfig } from "./config";




/* ============================================================
 * Helpers
 * ============================================================ */

const isJsonObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isTemplateFunction = (v: TemplateFunction | TemplateLiteral): v is TemplateFunction =>
  typeof v === "function";

const readLiteralFile = (absPath: string): TemplateLiteral => {
  const raw = fs.readFileSync(absPath, "utf8");
  let val = "";
  try {
    val = JSON.parse(raw);
  } catch {
    console.log(`invalid-json in file: ${absPath}`, raw);
    throw new Error(`invalid-json: ${absPath}`);
  }
  return val as JsonValue;
};

const readTemplateFile = (absPath: string): TemplateFunction => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(absPath);
  return (mod?.default ?? mod) as TemplateFunction;
};

/**
 * Deep merge for objects; arrays are REPLACE by default (your current rule).
 * (Array append is handled via the [] contributor mechanism, not via merge.)
 */
const deepMergeObjects = (a: JsonObject, b: JsonObject): JsonObject => {
  const out: JsonObject = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const av = out[k];
    if (isJsonObject(av) && isJsonObject(v)) {
      out[k] = deepMergeObjects(av, v);
    } else {
      out[k] = v as JsonValue;
    }
  }
  return out;
};

/* ============================================================
 * retrieveTemplate (strict, relative-to-root)
 * ============================================================ */

export function retrieveTemplate(
  tPath: FsRelPath,                 // filesystem-relative segments (dirs + tag)
  rootDirAbs: TemplateDirAbs
): [template: TemplateFunction | TemplateLiteral, absPath: string] {
  const cfg = getConfig();

  const segs = unwrapFsRelPath(tPath);
  if (segs.length === 0) {
    throw new Error(`invalid-template-id: empty template path`);
  }

  const dirSegs = segs.slice(0, -1);
  const tagRaw = segs[segs.length - 1];
  const tagName = asTemplateTagName(tagRaw);

  // rule: no explicit file types
  if (
    (tagRaw as string).endsWith(cfg.LITERAL_EXT) ||
    (tagRaw as string).endsWith(cfg.TEMPLATE_EXT)
  ) {
    throw new Error(`no-explicit-file-types: '${tagRaw}'`);
  }

  const literalAbs = path.join(
    unwrapFsAbsPath(rootDirAbs),
    ...dirSegs,
    literalFilename(tagName, cfg)
  );
  const fnAbs = path.join(
    unwrapFsAbsPath(rootDirAbs),
    ...dirSegs,
    templateFilename(tagName, cfg)
  );

  const literalExists = fs.existsSync(literalAbs);
  const fnExists = fs.existsSync(fnAbs);

  if (literalExists && fnExists) {
    throw new Error(
      `no-duplicate-templates: '${tagRaw}' resolves to both ${literalAbs} and ${fnAbs}`
    );
  }

  if (fnExists) return [readTemplateFile(fnAbs), fnAbs];
  if (literalExists) return [readLiteralFile(literalAbs), literalAbs];

  // implicit group lookup
  const hits = groupAgnosticFind(rootDirAbs, asFsRelPath(dirSegs), tagName, cfg);
  if (hits.length === 0) {
    throw new Error(
      `template-not-found: '${(tPath as unknown as string[]).join("/")}'`
    );
  }
  if (hits.length > 1) {
    throw new Error(
      `ambiguous-template-name: '${(tPath as unknown as string[]).join("/")}' hits=${JSON.stringify(
        hits.map((h) => unwrapFsRelPath(h)),
        null,
        2
      )}`
    );
  }

  const hitAbs = path.join(unwrapFsAbsPath(rootDirAbs), ...unwrapFsRelPath(hits[0]));
  if (hitAbs.endsWith(cfg.TEMPLATE_EXT)) return [readTemplateFile(hitAbs), hitAbs];
  if (hitAbs.endsWith(cfg.LITERAL_EXT)) return [readLiteralFile(hitAbs), hitAbs];

  throw new Error(`uncaught-exception: unrecognized extension: ${hitAbs}`);
}

/* ============================================================
 * apply() + resolveTemplateNode() with array semantics
 * ============================================================ */

export const apply = (tagNameRaw: string, args: Record<string, unknown> = {}): ApplyThunk => {
  const cfg = getConfig();
  const selector = parseApplySelector(tagNameRaw, cfg);

  const thunk: ApplyThunk = (slotCtx: SlotContext) => {
    const caller = slotCtx.template;

    // Build tPath relative to caller directory:
    // tPath = slotPath + [groupDir?] + tag
    const tPathRel = buildApplyTPath(slotCtx.slotPath, selector);

    // Root dir for this resolution is the caller's directory on disk
    const callerDirAbs = deriveCallerDirAbs(caller.templateDir, unwrapFsRelPath(caller.path));

    const [impl, implAbsPath] = retrieveTemplate(tPathRel, asTemplateDirAbs(unwrapFsAbsPath(callerDirAbs)));

    // Literal
    if (!isTemplateFunction(impl)) {
      if (Object.keys(args).length > 0) {
        throw new Error(
          `invalid-template-args: literal template '${toFsRelPathStr(tPathRel)}' called with args`
        );
      }
      return impl as TemplateLiteral;
    }

    // Function
    const fn = impl as TemplateFunction;

    // Subtemplate context:
    // - anchor should be the *slotAnchor* of where it’s being applied (includes [] markers there)
    //   BUT TemplateContext.anchor is keys-only mount anchor, so we must derive keys-only part.
    //   The mount anchor for applied template is still the caller's mount anchor plus slotPath up to first [].
    //
    // In practice: slotCtx.slotAnchor is SlotAnchor (may include []).
    // We keep TemplateContext.anchor keys-only by stripping everything after first [].
    const fullSlotAnchor = slotCtx.slotAnchor;
    const slotSegs = unwrapSlotPath(fullSlotAnchor);
    const firstArray = slotSegs.findIndex((s) => s === ARRAY_SEG);
    const mountKeys =
      firstArray === -1 ? (slotSegs as string[]) : (slotSegs.slice(0, firstArray) as string[]);
    const subAnchor = asTemplateAnchorPath(mountKeys);

    // The fs path for this subtemplate dir is caller.path + slotPath(fs) (+ group dir if used)
    const subDirSegs = unwrapFsRelPath(tPathRel).slice(0, -1);
    const subPath = asFsRelPath([...unwrapFsRelPath(caller.path), ...subDirSegs]);

    const subCtx: TemplateContext = {
      id: asTemplateId(tagNameRaw),
      anchor: subAnchor,
      templateDir: caller.templateDir,
      path: subPath,
      filename: path.basename(implAbsPath)
    };

    const tools: TemplateTools = { apply };

    const node = fn(args, subCtx, tools) as TemplateNode;
    return resolveTemplateNode(node, subCtx, asSlotPath([]));
  };

  return thunk;
};

/**
 * Resolve a TemplateNode into a pure JsonValue.
 *
 * IMPORTANT:
 * - Arrays push ARRAY_SEG into slotPath (not numeric indices).
 * - This is the mechanism that makes apply() inside arrays resolve from .../[]/...
 */
export function resolveTemplateNode(node: TemplateNode, ctx: TemplateContext, nodePath: SlotPath): JsonValue {
  // ApplyThunk
  if (typeof node === "function") {
    const thunk = node as ApplyThunk;
    const slotAnchor = makeSlotAnchor(ctx.anchor, nodePath);

    return thunk({
      template: ctx,
      slotPath: nodePath,
      slotAnchor
    });
  }

  // Array
  if (Array.isArray(node)) {
    const out: JsonArray = [];
    for (let i = 0; i < node.length; i++) {
      const child = node[i] as TemplateNode;
      // descend into array element context using ARRAY_SEG
      const childPath = slotPathPushArray(nodePath);
      out[i] = resolveTemplateNode(child, ctx, childPath);
    }
    return out;
  }

  // Object
  if (isJsonObject(node as any)) {
    const out: JsonObject = {};
    for (const [k, child] of Object.entries(node as JsonObject)) {
      const childPath = asSlotPath([...(unwrapSlotPath(nodePath) as any), k]);
      out[k] = resolveTemplateNode(child as TemplateNode, ctx, childPath);
    }
    return out;
  }

  // Primitive
  return node as JsonValue;
}

/* ============================================================
 * render() with array contributor templates
 * ============================================================ */

export function render(templateIds: string[], args: Record<string, unknown>): JsonObject {
  const cfg = getConfig();
  const templateRootAbs = asTemplateDirAbs(path.resolve(cfg.templateDir));

  const out: JsonObject = {};

  for (const tidRaw of templateIds) {
    const tid = toTemplateId(tidRaw);
    const tidPath = parseTemplateIdPath(tid);
    const { dir: dirSegs, tag } = splitTemplateIdPath(tidPath);

    // Retrieve template impl from root by logical path
    const tPathRel = asFsRelPath([...(dirSegs as string[]), tag as unknown as string]);
    const [impl, implAbs] = retrieveTemplate(tPathRel, templateRootAbs);

    // Determine mount anchor + whether this is an array contributor
    const mountAnchor = deriveMountAnchor(dirSegs, cfg); // keys only
    const { isArrayContributor, pushDepth } = deriveArrayContribution(dirSegs, cfg);

    // Build TemplateContext for this root template
    const ctx: TemplateContext = {
      id: tid,
      anchor: mountAnchor,
      templateDir: templateRootAbs,
      path: asFsRelPath(dirSegs),
      filename: path.basename(implAbs)
    };

    // Resolve template to value
    let val: JsonValue;
    if (isTemplateFunction(impl)) {
      const tools: TemplateTools = { apply };
      const node = (impl as TemplateFunction)(args, ctx, tools) as TemplateNode;
      val = resolveTemplateNode(node, ctx, asSlotPath([]));
    } else {
      val = impl as TemplateLiteral;
    }

    // Apply into output
    if (!isArrayContributor) {
      // Normal object mount: merge/replace at mountAnchor
      const keys = unwrapObjPath(mountAnchor);

      // root anchored object: merge at top
      if (keys.length === 0) {
        if (!isJsonObject(val)) {
          throw new Error(`invalid-anchor: root template must return object: ${tidRaw}`);
        }
        const merged = deepMergeObjects(out, val as JsonObject);
        Object.assign(out, merged);
        continue;
      }

      // descend and set/merge at last key
      let cur: JsonObject = out;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const isLast = i === keys.length - 1;

        if (isLast) {
          const existing = cur[k];
          if (isJsonObject(existing) && isJsonObject(val)) {
            cur[k] = deepMergeObjects(existing as JsonObject, val as JsonObject);
          } else {
            cur[k] = val;
          }
        } else {
          const existing = cur[k];
          if (!isJsonObject(existing)) cur[k] = {};
          cur = cur[k] as JsonObject;
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
      const keys = unwrapObjPath(mountAnchor);
      if (keys.length === 0) {
        throw new Error(`type-mismatch: cannot use [] contributor at root: ${tidRaw}`);
      }

      let cur: JsonObject = out;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const isLast = i === keys.length - 1;

        if (!isLast) {
          const existing = cur[k];
          if (!isJsonObject(existing)) cur[k] = {};
          cur = cur[k] as JsonObject;
          continue;
        }

        // last: this is the array field
        const existing = cur[k];
        if (existing === undefined) {
          cur[k] = [];
        } else if (!Array.isArray(existing)) {
          throw new Error(
            `append-type-mismatch: '${keys.join(
              "/"
            )}' is not an array but template '${tidRaw}' is an array contributor`
          );
        }

        let pushed: JsonValue = val;
        for (let d = 1; d < pushDepth; d++) {
          pushed = [pushed] as unknown as JsonValue;
        }

        (cur[k] as JsonArray).push(pushed);
      }
    }
  }

  return out;
}
