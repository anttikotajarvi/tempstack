// src/types/convert.ts

import { unwrapFsRelPath } from "./brands";
import {
  ARRAY_SEG,
  isArraySeg,

  // brands (arrays/strings)
  TemplateId,
  TemplateIdPath,
  TemplateDirAbs,
  TemplateAnchorPath,
  ObjPath,
  SlotPath,
  SlotAnchor,
  FsRelPath,
  FsAbsPath,

  GroupName,
  GroupDirname,

  // constructors / unwraps
  asTemplateId,
  asTemplateIdPath,
  asTemplateAnchorPath,
  asObjPath,
  asSlotPath,
  asSlotAnchor,
  asFsRelPath,
  asFsAbsPath,
  unwrapTemplateId,
  unwrapFsAbsPath,
  unwrapObjPath,
  unwrapSlotPath,

  // string renderers (for errors/logs)
  toTemplateIdStr,
  toObjPathStr,
  toSlotPathStr,
  toSlotAnchorStr,
  toFsRelPathStr,

  // fs join helper
  fsJoinAbs,

  // (proposed additions to brands.ts)
  TemplateTagName,
  asTemplateTagName
} from "./brands";

import type { Config } from "./index";

/* ============================================================
 * Utilities (internal)
 * ============================================================ */
let err = (code: string, msg: string): never => {
  throw new Error(`${code}: ${msg}`);
}
export function setErr(fn: (code:string, msg:string) => never): void {
    err = fn;
}

/** True if seg is a group directory segment under cfg.groupDirPrefix. */
export function isGroupDirSeg(seg: string, cfg: Config): boolean {
  return seg.startsWith(cfg.groupDirPrefix);
}

/** True if seg is a hidden dir segment under cfg.HIDDEN_DIR_PREFIX. */
export function isHiddenDirSeg(seg: string, cfg: Config): boolean {
  return seg.startsWith(cfg.HIDDEN_DIR_PREFIX);
}

/** Disallow slashes in a segment. */
function assertNoSlash(seg: string, what: string): void {
  if (seg.includes("/") || seg.includes("\\")) {
    err("invalid-segment", `${what} must not contain path separators: '${seg}'`);
  }
}

/** Disallow explicit file extensions in template tags (rule: no-explicit-file-types). */
function assertNoExplicitExt(tag: string, cfg: Config): void {
  if (tag.endsWith(cfg.LITERAL_EXT) || tag.endsWith(cfg.TEMPLATE_EXT)) {
    err(
      "no-explicit-file-types",
      `Template tag must not include file extension: '${tag}'`
    );
  }
}

/* ============================================================
 * TemplateId parsing / formatting
 * ============================================================ */

/**
 * Boundary: user input -> TemplateId.
 * (Does not validate; validation happens in parseTemplateIdPath)
 */
export function toTemplateId(raw: string): TemplateId {
  return asTemplateId(raw);
}

/**
 * Parse TemplateId string to TemplateIdPath segments.
 * - Splits by "/"
 * - Rejects empty segments (e.g. "a//b", "/a", "a/")
 */
export function parseTemplateIdPath(id: TemplateId): TemplateIdPath {
  const raw = unwrapTemplateId(id).trim();
  if (raw.length === 0) {
    err("invalid-template-id", "TemplateId is empty");
  }

  const segs = raw.split("/").map((s: string) => s.trim());
  if (segs.some((s: string) => s.length === 0)) {
    err("invalid-template-id", `TemplateId has empty segments: '${raw}'`);
  }

  // Optional: forbid "." / ".." segments entirely
  if (segs.some((s:string) => s === "." || s === "..")) {
    err("invalid-template-id", `TemplateId must not contain '.' or '..': '${raw}'`);
  }

  return asTemplateIdPath(segs);
}

/**
 * Extract (dirPath, tag) from TemplateIdPath.
 * tag is last segment, dir is everything before it.
 */
export function splitTemplateIdPath(
  p: TemplateIdPath
): { dir: readonly string[]; tag: TemplateTagName } {
  const segs = p as readonly string[];
  if (segs.length === 0) {
    err("invalid-template-id", "TemplateIdPath is empty");
  }
  const dir = segs.slice(0, -1);
  const tagRaw = segs[segs.length - 1];
  return { dir, tag: asTemplateTagName(tagRaw) };
}

/* ============================================================
 * Anchor derivation (mount path in output object)
 * ============================================================ */

/**
 * Derive the “logical” segments from a filesystem-ish directory segment list:
 * - drops group dirs
 * - drops hidden dirs
 * - keeps ARRAY_SEG ("[]") because it is meaningful for array contributors
 */
export function deriveLogicalSegmentsFromDir(
  dirSegs: readonly string[],
  cfg: Config
): readonly string[] {
  return dirSegs.filter(
    (seg) => !isGroupDirSeg(seg, cfg) && !isHiddenDirSeg(seg, cfg)
  );
}

/**
 * Derive mount anchor path (object keys only; never includes ARRAY_SEG).
 * This answers: "theme/colors/[]/red mounts on ['theme','colors']".
 */
export function deriveMountAnchor(
  dirSegs: readonly string[],
  cfg: Config
): TemplateAnchorPath {
  const logical = deriveLogicalSegmentsFromDir(dirSegs, cfg);

  const firstArrayIdx = logical.findIndex((s) => isArraySeg(s));
  const keyPart = firstArrayIdx === -1 ? logical : logical.slice(0, firstArrayIdx);

  // For mount anchor, forbid ARRAY_SEG and forbid empty
  return asTemplateAnchorPath(keyPart);
}

/**
 * Determine whether a template is an array contributor based on its directory logical segments.
 * If it contains ARRAY_SEG, it contributes to an array at mount anchor.
 *
 * pushDepth = number of ARRAY_SEG segments after the mount anchor before the tag.
 * Example:
 *   colors/[]/red        => pushDepth=1
 *   colors/[]/[]/red     => pushDepth=2
 */
export function deriveArrayContribution(
  dirSegs: readonly string[],
  cfg: Config
): { isArrayContributor: boolean; pushDepth: number } {
  const logical = deriveLogicalSegmentsFromDir(dirSegs, cfg);
  const firstArrayIdx = logical.findIndex((s) => isArraySeg(s));
  if (firstArrayIdx === -1) return { isArrayContributor: false, pushDepth: 0 };

  // Count consecutive [] segments from firstArrayIdx onward
  let depth = 0;
  for (let i = firstArrayIdx; i < logical.length; i++) {
    if (isArraySeg(logical[i])) depth++;
    else break;
  }
  return { isArrayContributor: true, pushDepth: depth };
}

/* ============================================================
 * Slot path / slot anchor derivation
 * ============================================================ */

/** Combine mount anchor + slotPath into a SlotAnchor. */
export function makeSlotAnchor(
  anchor: TemplateAnchorPath,
  slotPath: SlotPath
): SlotAnchor {
  const a = unwrapObjPath(anchor);
  const s = unwrapSlotPath(slotPath);
  return asSlotAnchor([...(a as string[]), ...(s as string[])]);
}

/** Append an object key to a SlotPath. */
export function slotPathPushKey(slot: SlotPath, key: string): SlotPath {
  assertNoSlash(key, "Slot key");
  const s = unwrapSlotPath(slot);
  return asSlotPath([...(s as any), key]);
}

/** Append ARRAY_SEG to a SlotPath to represent descending into an array element context. */
export function slotPathPushArray(slot: SlotPath): SlotPath {
  const s = unwrapSlotPath(slot);
  return asSlotPath([...(s as any), ARRAY_SEG]);
}

/* ============================================================
 * Apply selector parsing (group::tag)
 * ============================================================ */

export type ApplySelector =
  | { kind: "plain"; tag: TemplateTagName }
  | { kind: "grouped"; group: GroupName; groupDir: GroupDirname; tag: TemplateTagName };

/**
 * Parse apply tag selector:
 * - "red" -> plain
 * - "dark::red" -> grouped
 *
 * Important: tagName MUST NOT be a path. This enforces your invariant.
 */
export function parseApplySelector(raw: string, cfg: Config): ApplySelector {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    err("invalid-template-id", "apply() tagName is empty");
  }

  // forbid slashes outright
  assertNoSlash(trimmed, "apply() selector");

  const sepIdx = trimmed.indexOf("::");
  if (sepIdx === -1) {
    assertNoExplicitExt(trimmed, cfg);
    return { kind: "plain", tag: asTemplateTagName(trimmed) };
  }

  const groupPart = trimmed.slice(0, sepIdx).trim();
  const tagPart = trimmed.slice(sepIdx + 2).trim();
  if (!groupPart || !tagPart) {
    err("invalid-template-id", `Invalid group selector syntax: '${trimmed}'`);
  }

  assertNoExplicitExt(tagPart, cfg);

  // In your spec: group selector uses cfg.groupDirPrefix ONLY, not hidden prefix.
  const group = groupPart as unknown as GroupName;
  const groupDir = (cfg.groupDirPrefix + groupPart) as unknown as GroupDirname;

  return {
    kind: "grouped",
    group,
    groupDir,
    tag: asTemplateTagName(tagPart)
  };
}

/* ============================================================
 * Apply resolution path construction
 * ============================================================ */

/**
 * Convert SlotPath to a filesystem-relative path segment list for apply resolution.
 * SlotPath must be interpreted literally as directories, including ARRAY_SEG.
 */
export function slotPathToFsRel(slotPath: SlotPath): FsRelPath {
  const s = unwrapSlotPath(slotPath) as readonly (string | typeof ARRAY_SEG)[];
  return asFsRelPath([...s] as readonly string[]);
}

/**
 * Build tPath segments for retrieveTemplate() from a slotPath + apply selector.
 * This returns a filesystem-relative tPath, *relative to the callerDirAbs*.
 *
 * Examples:
 *  slotPath=["style","color"], apply("red") -> ["style","color","red"]
 *  slotPath=["colors","[]"], apply("red")   -> ["colors","[]","red"]
 *  slotPath=["style","color"], apply("dark::red") -> ["style","color",".dark","red"]
 */
export function buildApplyTPath(
  slotPath: SlotPath,
  selector: ApplySelector
): FsRelPath {
  const base = unwrapFsRelPath(slotPathToFsRel(slotPath));
  const out: string[] = [...base];

  if (selector.kind === "grouped") {
    out.push(selector.groupDir as unknown as string);
  }

  out.push(selector.tag as unknown as string);
  return asFsRelPath(out);
}

/* ============================================================
 * Filesystem absolute path derivations
 * ============================================================ */

/**
 * Compute caller directory absolute path from TemplateContext pieces.
 * (templateDirAbs + caller.path segments)
 */
export function deriveCallerDirAbs(
  templateDir: TemplateDirAbs,
  callerPathSegs: readonly string[]
): FsAbsPath {
  return fsJoinAbs(unwrapFsAbsPath(templateDir), ...callerPathSegs);
}

/**
 * Convert templateDirAbs + FsRelPath -> FsAbsPath (file/dir).
 */
export function absFromTemplateDir(
  templateDir: TemplateDirAbs,
  rel: FsRelPath
): FsAbsPath {
  return fsJoinAbs(unwrapFsAbsPath(templateDir), ...(unwrapFsRelPath(rel) as string[]));
}

/* ============================================================
 * Debug / log helpers (explicit, typed)
 * ============================================================ */

export function dbgTemplateIdPath(p: TemplateIdPath): string {
  return toTemplateIdStr(p) as unknown as string;
}

export function dbgMountAnchor(p: TemplateAnchorPath): string {
  return toObjPathStr(p) as unknown as string;
}

export function dbgSlotPath(p: SlotPath): string {
  return toSlotPathStr(p) as unknown as string;
}

export function dbgSlotAnchor(p: SlotAnchor): string {
  return toSlotAnchorStr(p) as unknown as string;
}

export function dbgFsRel(p: FsRelPath): string {
  return toFsRelPathStr(p) as unknown as string;
}
