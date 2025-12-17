
import * as fs from "fs";
import * as path from "path";

import { getConfig } from "./config";

enum ERROR_CODES {
  NO_EXPLICIT_FILE_TYPES = "no-explicit-file-types",
  NO_DUPLICATE_TEMPLATES = "no-duplicate-templates",
  TEMPLATE_NOT_FOUND = "template-not-found",
  UNEXPECTED_READ_ERROR = "unexpected-read-error",
  UNEXPECTED_REQUIRE_ERROR = "unexpected-require-error",
  UNCAUGHT_EXCEPTION = "uncaught-exception",
  AMBIGIOUS_TEMPLATE_NAME = "ambigious-template-name",
  TEMPLATE_EXECUTION_ERROR = "template-execution-error",
  INVALID_TEMPLATE_TYPE = "invalid-template-type",
  INVALID_ANCHOR = "invalid-anchor",
  INVALID_TEMPLATE_ID = "invalid-template-id",
  INVALID_TEMPLATE_ARGS = "invalid-template-args",
  INVALID_BASE_TEMPLATE = "invalid-base-template",
}


import { groupAgnosticFindWithFs, HIDDEN_FILE_PREFIX, literalFilename, templateFilename } from "./filesystem";
import {
    ApplyThunk,
  isTemplateFunction,
  isTemplateLiteral,
  JsonArray,
  JsonObject,
  JsonValue,
  Path,
  SlotContext,
  TemplateContext,
  TemplateFunction,
  TemplateLiteral,
  TemplateNode,
  TemplateTools,
} from "./types";
import { deepMergeObjects, isJsonObject, splitPath } from "./util";

const groupAgnosticFind = groupAgnosticFindWithFs(fs);

const error =
  (processName: string) =>
  (code: ERROR_CODES, msg: any): never => {
    throw new Error(`${code} from ${processName}: ${msg}`);
  };

function readLiteralFile(file: string): TemplateLiteral {
  const E = error("READ_LITERAL");
  try {
    const content = fs.readFileSync(file, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return E(ERROR_CODES.UNEXPECTED_READ_ERROR, `Error reading or parsing file: ${file}`);
  }
}
function readTemplateFile(file: string): TemplateFunction {
  const E = error("READ_TEMPLATE_FILE");
  try {
    const fn = require(file);
    return fn as TemplateFunction;
  } catch (err) {
    return E(ERROR_CODES.UNEXPECTED_REQUIRE_ERROR, `Error importing file: ${file}`);
  }
}

export function retrieveTemplate(tPath: string[], root: string)
: [template: TemplateFunction | TemplateLiteral, absolutePath:string] {
  const E = error("READ_TEMPLATE");
  const cfg = getConfig();


  const dirPath = tPath.slice(0, -1);
  const tagName = tPath[tPath.length - 1];

  // [RULE] no-explicit-file-types
  if (tagName.endsWith(cfg.LITERAL_EXT) || tagName.endsWith(cfg.TEMPLATE_EXT)) {
    E(
      ERROR_CODES.NO_EXPLICIT_FILE_TYPES,
      `Template tag name must not include file extension: ${tagName}`
    );
  }

  const literalPathAbs = path.join(
    root,
    ...dirPath,
    literalFilename(tagName)
  );

  const templatePathAbs = path.join(
    root,
    ...dirPath,
    templateFilename(tagName)
  );
  const templateExists = fs.existsSync(templatePathAbs);
  const literalExists = fs.existsSync(literalPathAbs);

  // [RULE] no-duplicate-templates
  if (literalExists && templateExists) {
    return E(
      ERROR_CODES.NO_DUPLICATE_TEMPLATES,
      `Template tag name resolves to both literal and function template: ${tagName}`
    );
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
      return E(
        ERROR_CODES.TEMPLATE_NOT_FOUND,
        `Template not found: ${[...dirPath, tagName].join("/")}`
      );
    } else if (groupHits.length === 1) {
      // unique implicit group: load that file (json/js) and return it
      const filepathAbs = path.join(root, ...groupHits[0]);
      if (filepathAbs.endsWith(cfg.TEMPLATE_EXT))
        return [readTemplateFile(filepathAbs), filepathAbs];

      if (filepathAbs.endsWith(cfg.LITERAL_EXT))
        return [readLiteralFile(filepathAbs), filepathAbs];

      return E(
        ERROR_CODES.UNCAUGHT_EXCEPTION,
        `Unrecognized extension from a shorthand call: ${filepathAbs}`
      );
    } else {
      // >1 -> shorthand is ambiguous -> error, tell user to specify group explicitly
      return E(
        ERROR_CODES.AMBIGIOUS_TEMPLATE_NAME,
        `Multiple matches for template ID: '${path.join(
          ...tPath
        )}' in ${JSON.stringify(groupHits, null, 2)}`
      );
    }
  }
}

const apply = (
  tagName: string,
  args: Record<string, unknown> = {}
): ApplyThunk => {
  const E = error("APPLY_THUNK_EXECUTION");
  const cfg = getConfig();

  // Parse optional group syntax: "group::tag"
  let baseTag = tagName;
  let groupDir: string | null = null;

  const sepIdx = tagName.indexOf("::");
  if (sepIdx !== -1) {
    const groupName = tagName.slice(0, sepIdx).trim();
    const tagPart = tagName.slice(2 + sepIdx).trim();

    if (!groupName || !tagPart) {
      return E(
        ERROR_CODES.INVALID_TEMPLATE_ID,
        `Invalid group selector syntax in apply(): '${tagName}'`
      );
    }

    baseTag = tagPart;
    // Only groupDirPrefix, NOT hidden prefix
    groupDir = cfg.groupDirPrefix + groupName;
  }

  const thunk: ApplyThunk = (slotCtx: SlotContext) => {
    const { template: caller, slotPath, slotAnchor } = slotCtx;

    if (!caller.templateDir) {
      return E(
        ERROR_CODES.UNCAUGHT_EXCEPTION,
        `Invalid TemplateContext for apply('${tagName}') in ${caller.id}`
      );
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
    const dirSegments: string[] = [...slotPath]; // e.g. ["style","color"]
    if (groupDir) {
      dirSegments.push(groupDir);
    }
    const tPath: string[] = [...dirSegments, baseTag];

    // Root dir for this resolution is the caller's directory on disk
    const callerDirAbs = path.join(caller.templateDir, ...caller.path);

    const [templateImpl, templatePathAbs] = retrieveTemplate(tPath, callerDirAbs);

    // --- Literal template case ---
    if (isTemplateLiteral(templateImpl)) {
      if (Object.keys(args).length > 0) {
        return E(
          ERROR_CODES.INVALID_TEMPLATE_ARGS,
          `Template '${tPath.join(
            "/"
          )}' is literal but apply() was given arguments: ${JSON.stringify(
            args
          )}`
        );
      }
      return templateImpl as TemplateLiteral;
    }

    // --- Function template case ---
    if (!isTemplateFunction(templateImpl)) {
      return E(
        ERROR_CODES.INVALID_TEMPLATE_TYPE,
        `Template '${tPath.join(
          "/"
        )}' is neither literal nor function in apply('${tagName}')`
      );
    }

      const fn = templateImpl as TemplateFunction;

      // Build TemplateContext for the subtemplate
      // Path of the subtemplate dir is caller.path + dirSegments
      const subPath: Path = [...caller.path, ...dirSegments];

      const subCtx: TemplateContext = {
        id: tPath.join("/"),        // you can refine this if you like
        anchor: slotAnchor,         // subtemplate anchors exactly at this slot
        templateDir: caller.templateDir,
        path: subPath,
        filename: path.basename(templatePathAbs)
      };

      const subTools: TemplateTools = { apply };

      const resultNode = fn(args, subCtx, subTools) as TemplateNode;

      // Resolve nested applies within the subtemplate
      return resolveTemplateNode(resultNode, subCtx, []);

  };

  return thunk;
};


export function resolveTemplateNode(
  node: TemplateNode,
  ctx: TemplateContext,
  nodePath: string[] // path inside this template's result
): JsonValue {
  //const E = error("RESOLVE_TEMPLATE_NODE");

  // ApplyThunk
  if (typeof node === "function") {
    const thunk = node as ApplyThunk;
    const slotAnchor = [...ctx.anchor, ...nodePath];

      return thunk({
        template: ctx,
        slotPath: nodePath,
        slotAnchor
      });
  }

  // Array branch
  if (Array.isArray(node)) {
    const out: JsonArray = [];
    for (let i = 0; i < node.length; i++) {
      const child = node[i] as TemplateNode;
      out[i] = resolveTemplateNode(child, ctx, [...nodePath, String(i)]);
    }
    return out;
  }

  // Object branch
  if (isJsonObject(node as JsonObject)) {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(node as JsonObject)) {
      out[key] = resolveTemplateNode(child as TemplateNode, ctx, [
        ...nodePath,
        key
      ]);
    }
    return out;
  }

  // Primitive JsonValue
  return node as JsonValue;
}


// cfg.groupDirPrefix + HIDDEN_FILE_PREFIX assumed in scope
// splitPath, retrieveTemplate, error, ERROR_CODES assumed in scope

export function render(
  templateIds: string[],
  args: Record<string, unknown>
): JsonObject {
  const E = error("RENDER_TEMPLATES");
  const cfg = getConfig();

  // --- Seed output with base.json if present ---
  let out: JsonObject = {};

  // --- Apply each top-level template id in order ---
  for (const tid of templateIds) {
    const tPath = splitPath(tid); // e.g. ["render", ".a", "look", "main"]

    if (tPath.length === 0) {
      return E(
        ERROR_CODES.INVALID_TEMPLATE_ID,
        `Empty template ID in render(): '${tid}'`
      );
    }

    // Directory segments (relative to templateDir), including groups
    const dirPath = tPath.slice(0, -1); // ["render",".a","look"]

    // Logical anchor path: drop group/hidden dirs
    const anchorSegments = dirPath.filter(
      (seg) =>
        !seg.startsWith(cfg.groupDirPrefix) &&
        !seg.startsWith(HIDDEN_FILE_PREFIX)
    );

    // Load template implementation and its absolute filepath
    const [templateImpl, templatePathAbs] = retrieveTemplate(
      tPath,
      cfg.templateDir
    );

    let val: JsonValue;

    if (isTemplateFunction(templateImpl)) {
      const fn = templateImpl as TemplateFunction;

      const ctx: TemplateContext = {
        id: tid,
        anchor: anchorSegments,
        templateDir: cfg.templateDir,
        path: dirPath,
        filename: path.basename(templatePathAbs)
      };

      const tools: TemplateTools = { apply };

      let node;
      try {
        node = fn(args, ctx, tools) as TemplateNode;
        // Collapse all ApplyThunks to a pure JsonValue tree

      } catch (err) {
        return E(
          ERROR_CODES.TEMPLATE_EXECUTION_ERROR,
          `Error executing template function '${tid}': ${
            (err as Error).message
          }`
        );
      }
      
      val = resolveTemplateNode(node, ctx, []);
    } else {
      // Literal template: already a pure JsonValue
      val = templateImpl as TemplateLiteral;
    }

    // --- Merge `val` into `out` at the logical anchor ---

    // Root-anchored template
    if (anchorSegments.length === 0) {
      if (!isJsonObject(val as JsonObject)) {
        return E(
          ERROR_CODES.INVALID_ANCHOR,
          `Root-anchored template must return an object: ${tid}`
        );
      }

      const merged = deepMergeObjects(out, val as JsonObject);
      Object.assign(out, merged);
      continue;
    }

    // Non-root anchor
    let cur: JsonObject = out;

    anchorSegments.forEach((seg, idx) => {
      const isLast = idx === anchorSegments.length - 1;

      if (isLast) {
        const existing = cur[seg];

        if (isJsonObject(existing) && isJsonObject(val)) {
          cur[seg] = deepMergeObjects(
            existing as JsonObject,
            val as JsonObject
          );
        } else {
          cur[seg] = val;
        }
      } else {
        const existing = cur[seg];

        if (!isJsonObject(existing)) {
          cur[seg] = {};
        }

        cur = cur[seg] as JsonObject;
      }
    });
  }

  return out;
}


