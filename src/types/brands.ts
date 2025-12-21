// src/types/brands.ts
//
// Nominal / branded primitive types used across the system.
// Goal: eliminate confusion between different "string[] paths" and different
// "stringified with '/'" representations.
//
// Rules:
// - Prefer branded readonly arrays (ObjPath, SlotPath, FsRelPath, etc.) internally.
// - Only unwrap to plain string / string[] at true I/O boundaries.
// - Never use `join("/")` directly in app code; use the typed stringify helpers here.

import path from "node:path";

/* =========================
 * Branding utility
 * ========================= */

type Brand<T, Sym extends symbol> = T & { readonly [K in Sym]: true };

/* =========================
 * Brand symbols
 * ========================= */

// Path arrays
export declare const ObjPathBrand: unique symbol;
export declare const TemplateAnchorBrand: unique symbol;

export declare const SlotPathBrand: unique symbol;
export declare const SlotAnchorBrand: unique symbol;

export declare const FsRelPathBrand: unique symbol;

export declare const TemplateIdPathBrand: unique symbol;

// Path strings / ids
export declare const FsAbsPathBrand: unique symbol;
export declare const TemplateDirAbsBrand: unique symbol;

export declare const TemplateIdBrand: unique symbol;

export declare const TemplateTagNameBrand: unique symbol;

export declare const GroupNameBrand: unique symbol;
export declare const GroupDirnameBrand: unique symbol;

// Stringified-with-"/" display strings (NOT OS paths)
export declare const ObjPathStrBrand: unique symbol;
export declare const TemplateAnchorStrBrand: unique symbol;

export declare const SlotPathStrBrand: unique symbol;
export declare const SlotAnchorStrBrand: unique symbol;

export declare const FsRelPathStrBrand: unique symbol;
export declare const TemplateIdStrBrand: unique symbol;

// OS-path strings for logging/debug only
export declare const FsAbsPathStrBrand: unique symbol;

// (Optional) single segment brands (useful when you want extra clarity)
export declare const FsDirnameBrand: unique symbol;
export declare const FsFilenameBrand: unique symbol;

/* =========================
 * Array segment marker
 * ========================= */

export const ARRAY_SEG = "[]" as const;
export type ArraySeg = typeof ARRAY_SEG;
export const isArraySeg = (s: string): s is ArraySeg => s === ARRAY_SEG;

/* =========================
 * Path segment types
 * ========================= */

/** Object/mount keys only (never "[]", never group/hidden dirs). */
export type ObjSeg = string;

/** Slot resolution segments: keys plus the literal array marker "[]". */
export type SlotSeg = string | ArraySeg;

/** Filesystem segment: directory/file name (may include ".", "[]", group dirs, etc.). */
export type FsSeg = string;

/* =========================
 * Branded array path types (readonly)
 * ========================= */

/**
 * Object path used for mounting/merging into the output object.
 * Keys only; MUST NOT contain ARRAY_SEG.
 */
export type ObjPath = Brand<readonly ObjSeg[], typeof ObjPathBrand>;

/**
 * Template anchor path (same semantics as ObjPath).
 * This is kept separate to prevent accidental mixing in callsites.
 */
export type TemplateAnchorPath = Brand<readonly ObjSeg[], typeof TemplateAnchorBrand>;

/**
 * Slot path inside a returned TemplateNode. Used for apply() resolution.
 * Includes ARRAY_SEG markers when descending into arrays.
 */
export type SlotPath = Brand<readonly SlotSeg[], typeof SlotPathBrand>;

/**
 * Absolute slot address = (template.anchor + slotPath).
 * May include ARRAY_SEG.
 */
export type SlotAnchor = Brand<readonly SlotSeg[], typeof SlotAnchorBrand>;

/**
 * Filesystem-relative segments under a known root (template dir or caller dir).
 * May include ARRAY_SEG (because you literally use a directory named "[]"),
 * group dirs, hidden dirs, etc.
 */
export type FsRelPath = Brand<readonly FsSeg[], typeof FsRelPathBrand>;

/**
 * Parsed template id segments (split by "/").
 * Semantics are logical (not OS). Content depends on where it came from.
 */
export type TemplateIdPath = Brand<readonly string[], typeof TemplateIdPathBrand>;

/* =========================
 * Branded IDs / names
 * ========================= */

/** User-facing template id string: "render/look/default" */
export type TemplateId = Brand<string, typeof TemplateIdBrand>;

/** Final segment of TemplateIdPath, with rule: no explicit file extension. */
export type TemplateTagName = Brand<string, typeof TemplateTagNameBrand>;

/** "dark" in "dark::red" */
export type GroupName = Brand<string, typeof GroupNameBrand>;

/** Derived dirname for group: cfg.groupDirPrefix + groupName (e.g. ".dark") */
export type GroupDirname = Brand<string, typeof GroupDirnameBrand>;

/* =========================
 * Branded filesystem absolute paths
 * ========================= */

/** Absolute (or effectively absolute) OS path string used for IO. */
export type FsAbsPath = Brand<string, typeof FsAbsPathBrand>;

/** OS path string that is known to be the template root directory. */
export type TemplateDirAbs = Brand<FsAbsPath, typeof TemplateDirAbsBrand>;

/* =========================
 * Branded "joined with /" display strings
 * (NOT OS paths; use for logs/errors/UI only)
 * ========================= */

export type ObjPathStr = Brand<string, typeof ObjPathStrBrand>;
export type TemplateAnchorStr = Brand<string, typeof TemplateAnchorStrBrand>;

export type SlotPathStr = Brand<string, typeof SlotPathStrBrand>;
export type SlotAnchorStr = Brand<string, typeof SlotAnchorStrBrand>;

export type FsRelPathStr = Brand<string, typeof FsRelPathStrBrand>;
export type TemplateIdStr = Brand<string, typeof TemplateIdStrBrand>;

export type FsAbsPathStr = Brand<string, typeof FsAbsPathStrBrand>;

/* =========================
 * Optional single-segment brands
 * ========================= */

export type FsDirname = Brand<string, typeof FsDirnameBrand>;
export type FsFilename = Brand<string, typeof FsFilenameBrand>;

/* =========================
 * Boundary constructors (use sparingly)
 * ========================= */

export function asObjPath(p: readonly ObjSeg[]): ObjPath {
  return p as ObjPath;
}

export function asTemplateAnchorPath(p: readonly ObjSeg[]): TemplateAnchorPath {
  return p as TemplateAnchorPath;
}

export function asSlotPath(p: readonly SlotSeg[]): SlotPath {
  return p as SlotPath;
}

export function asSlotAnchor(p: readonly SlotSeg[]): SlotAnchor {
  return p as SlotAnchor;
}

export function asFsRelPath(p: readonly FsSeg[]): FsRelPath {
  return p as FsRelPath;
}

export function asTemplateIdPath(p: readonly string[]): TemplateIdPath {
  return p as TemplateIdPath;
}

export function asTemplateId(s: string): TemplateId {
  return s as TemplateId;
}

export function asTemplateTagName(s: string): TemplateTagName {
  return s as TemplateTagName;
}

export function asGroupName(s: string): GroupName {
  return s as GroupName;
}

export function asGroupDirname(s: string): GroupDirname {
  return s as GroupDirname;
}

export function asFsAbsPath(p: string): FsAbsPath {
  return p as FsAbsPath;
}

export function asTemplateDirAbs(p: string): TemplateDirAbs {
  return asFsAbsPath(p) as TemplateDirAbs;
}

export function asFsDirname(s: string): FsDirname {
  return s as FsDirname;
}

export function asFsFilename(s: string): FsFilename {
  return s as FsFilename;
}

/* =========================
 * Unwrap helpers (explicit escape hatches)
 * ========================= */

export function unwrapObjPath(p: ObjPath | TemplateAnchorPath): readonly string[] {
  return p as unknown as readonly string[];
}

export function unwrapSlotPath(p: SlotPath | SlotAnchor): readonly SlotSeg[] {
  return p as unknown as readonly SlotSeg[];
}

export function unwrapFsRelPath(p: FsRelPath): readonly string[] {
  return p as unknown as readonly string[];
}

export function unwrapFsAbsPath(p: FsAbsPath | TemplateDirAbs): string {
  return p as unknown as string;
}

export function unwrapTemplateId(id: TemplateId): string {
  return id as unknown as string;
}

/**
 * FS IO boundary helper: use ONLY when passing paths into fs APIs.
 * (Stricter alternative to `asString`.)
 */
export function asFsString(p: FsAbsPath | TemplateDirAbs): string {
  return unwrapFsAbsPath(p);
}

/* =========================
 * "/" joiners (typed, NO unions)
 * ========================= */

const joinSlash = (segs: readonly string[]): string => segs.join("/");

/** ObjPath/TemplateAnchorPath -> display string "a/b/c" */
export function toObjPathStr(p: ObjPath | TemplateAnchorPath): ObjPathStr {
  return joinSlash(unwrapObjPath(p)) as ObjPathStr;
}

export function toTemplateAnchorStr(p: TemplateAnchorPath): TemplateAnchorStr {
  return joinSlash(unwrapObjPath(p)) as TemplateAnchorStr;
}

/** SlotPath -> display string (may include "[]") */
export function toSlotPathStr(p: SlotPath): SlotPathStr {
  return joinSlash(unwrapSlotPath(p) as unknown as readonly string[]) as SlotPathStr;
}

/** SlotAnchor -> display string (may include "[]") */
export function toSlotAnchorStr(p: SlotAnchor): SlotAnchorStr {
  return joinSlash(unwrapSlotPath(p) as unknown as readonly string[]) as SlotAnchorStr;
}

/** FsRelPath -> display string */
export function toFsRelPathStr(p: FsRelPath): FsRelPathStr {
  return joinSlash(unwrapFsRelPath(p)) as FsRelPathStr;
}

/** TemplateIdPath -> display string */
export function toTemplateIdStr(p: TemplateIdPath): TemplateIdStr {
  return joinSlash(p as unknown as readonly string[]) as TemplateIdStr;
}

/* =========================
 * OS-path join helpers (typed)
 * ========================= */

/** Join OS paths and brand as FsAbsPath (safe for fs IO after unwrap). */
export function fsJoinAbs(...parts: string[]): FsAbsPath {
  return asFsAbsPath(path.join(...parts));
}

/** Mostly for logs; do not feed into fs without unwrap/asFsString. */
export function toFsAbsPathStr(p: FsAbsPath | TemplateDirAbs): FsAbsPathStr {
  return unwrapFsAbsPath(p) as FsAbsPathStr;
}

/* =========================
 * Explicit "string boundary" helper
 * ========================= */

/**
 * Generic explicit escape hatch to plain JS string.
 * Prefer `asFsString()` for IO, and prefer the typed toXxxStr() for logs.
 */
export function asString(
  s:
    | TemplateId
    | FsAbsPath
    | TemplateDirAbs
    | ObjPathStr
    | SlotPathStr
    | SlotAnchorStr
    | FsRelPathStr
    | TemplateIdStr
    | TemplateAnchorStr
    | FsAbsPathStr
    | GroupName
    | GroupDirname
    | TemplateTagName
): string {
  return s as unknown as string;
}
