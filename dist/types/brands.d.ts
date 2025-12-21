type Brand<T, Sym extends symbol> = T & {
    readonly [K in Sym]: true;
};
export declare const ObjPathBrand: unique symbol;
export declare const TemplateAnchorBrand: unique symbol;
export declare const SlotPathBrand: unique symbol;
export declare const SlotAnchorBrand: unique symbol;
export declare const FsRelPathBrand: unique symbol;
export declare const TemplateIdPathBrand: unique symbol;
export declare const FsAbsPathBrand: unique symbol;
export declare const TemplateDirAbsBrand: unique symbol;
export declare const TemplateIdBrand: unique symbol;
export declare const TemplateTagNameBrand: unique symbol;
export declare const GroupNameBrand: unique symbol;
export declare const GroupDirnameBrand: unique symbol;
export declare const ObjPathStrBrand: unique symbol;
export declare const TemplateAnchorStrBrand: unique symbol;
export declare const SlotPathStrBrand: unique symbol;
export declare const SlotAnchorStrBrand: unique symbol;
export declare const FsRelPathStrBrand: unique symbol;
export declare const TemplateIdStrBrand: unique symbol;
export declare const FsAbsPathStrBrand: unique symbol;
export declare const FsDirnameBrand: unique symbol;
export declare const FsFilenameBrand: unique symbol;
export declare const ARRAY_SEG: "[]";
export type ArraySeg = typeof ARRAY_SEG;
export declare const isArraySeg: (s: string) => s is ArraySeg;
/** Object/mount keys only (never "[]", never group/hidden dirs). */
export type ObjSeg = string;
/** Slot resolution segments: keys plus the literal array marker "[]". */
export type SlotSeg = string | ArraySeg;
/** Filesystem segment: directory/file name (may include ".", "[]", group dirs, etc.). */
export type FsSeg = string;
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
/** User-facing template id string: "render/look/default" */
export type TemplateId = Brand<string, typeof TemplateIdBrand>;
/** Final segment of TemplateIdPath, with rule: no explicit file extension. */
export type TemplateTagName = Brand<string, typeof TemplateTagNameBrand>;
/** "dark" in "dark::red" */
export type GroupName = Brand<string, typeof GroupNameBrand>;
/** Derived dirname for group: cfg.groupDirPrefix + groupName (e.g. ".dark") */
export type GroupDirname = Brand<string, typeof GroupDirnameBrand>;
/** Absolute (or effectively absolute) OS path string used for IO. */
export type FsAbsPath = Brand<string, typeof FsAbsPathBrand>;
/** OS path string that is known to be the template root directory. */
export type TemplateDirAbs = Brand<FsAbsPath, typeof TemplateDirAbsBrand>;
export type ObjPathStr = Brand<string, typeof ObjPathStrBrand>;
export type TemplateAnchorStr = Brand<string, typeof TemplateAnchorStrBrand>;
export type SlotPathStr = Brand<string, typeof SlotPathStrBrand>;
export type SlotAnchorStr = Brand<string, typeof SlotAnchorStrBrand>;
export type FsRelPathStr = Brand<string, typeof FsRelPathStrBrand>;
export type TemplateIdStr = Brand<string, typeof TemplateIdStrBrand>;
export type FsAbsPathStr = Brand<string, typeof FsAbsPathStrBrand>;
export type FsDirname = Brand<string, typeof FsDirnameBrand>;
export type FsFilename = Brand<string, typeof FsFilenameBrand>;
export declare function asObjPath(p: readonly ObjSeg[]): ObjPath;
export declare function asTemplateAnchorPath(p: readonly ObjSeg[]): TemplateAnchorPath;
export declare function asSlotPath(p: readonly SlotSeg[]): SlotPath;
export declare function asSlotAnchor(p: readonly SlotSeg[]): SlotAnchor;
export declare function asFsRelPath(p: readonly FsSeg[]): FsRelPath;
export declare function asTemplateIdPath(p: readonly string[]): TemplateIdPath;
export declare function asTemplateId(s: string): TemplateId;
export declare function asTemplateTagName(s: string): TemplateTagName;
export declare function asGroupName(s: string): GroupName;
export declare function asGroupDirname(s: string): GroupDirname;
export declare function asFsAbsPath(p: string): FsAbsPath;
export declare function asTemplateDirAbs(p: string): TemplateDirAbs;
export declare function asFsDirname(s: string): FsDirname;
export declare function asFsFilename(s: string): FsFilename;
export declare function unwrapObjPath(p: ObjPath | TemplateAnchorPath): readonly string[];
export declare function unwrapSlotPath(p: SlotPath | SlotAnchor): readonly SlotSeg[];
export declare function unwrapFsRelPath(p: FsRelPath): readonly string[];
export declare function unwrapFsAbsPath(p: FsAbsPath | TemplateDirAbs): string;
export declare function unwrapTemplateId(id: TemplateId): string;
/**
 * FS IO boundary helper: use ONLY when passing paths into fs APIs.
 * (Stricter alternative to `asString`.)
 */
export declare function asFsString(p: FsAbsPath | TemplateDirAbs): string;
/** ObjPath/TemplateAnchorPath -> display string "a/b/c" */
export declare function toObjPathStr(p: ObjPath | TemplateAnchorPath): ObjPathStr;
export declare function toTemplateAnchorStr(p: TemplateAnchorPath): TemplateAnchorStr;
/** SlotPath -> display string (may include "[]") */
export declare function toSlotPathStr(p: SlotPath): SlotPathStr;
/** SlotAnchor -> display string (may include "[]") */
export declare function toSlotAnchorStr(p: SlotAnchor): SlotAnchorStr;
/** FsRelPath -> display string */
export declare function toFsRelPathStr(p: FsRelPath): FsRelPathStr;
/** TemplateIdPath -> display string */
export declare function toTemplateIdStr(p: TemplateIdPath): TemplateIdStr;
/** Join OS paths and brand as FsAbsPath (safe for fs IO after unwrap). */
export declare function fsJoinAbs(...parts: string[]): FsAbsPath;
/** Mostly for logs; do not feed into fs without unwrap/asFsString. */
export declare function toFsAbsPathStr(p: FsAbsPath | TemplateDirAbs): FsAbsPathStr;
/**
 * Generic explicit escape hatch to plain JS string.
 * Prefer `asFsString()` for IO, and prefer the typed toXxxStr() for logs.
 */
export declare function asString(s: TemplateId | FsAbsPath | TemplateDirAbs | ObjPathStr | SlotPathStr | SlotAnchorStr | FsRelPathStr | TemplateIdStr | TemplateAnchorStr | FsAbsPathStr | GroupName | GroupDirname | TemplateTagName): string;
export {};
