import { TemplateId, TemplateIdPath, TemplateDirAbs, TemplateAnchorPath, SlotPath, SlotAnchor, FsRelPath, FsAbsPath, GroupName, GroupDirname, TemplateTagName } from "./brands";
import type { Config } from "./index";
export declare function setErr(fn: (code: string, msg: string) => never): void;
/** True if seg is a group directory segment under cfg.groupDirPrefix. */
export declare function isGroupDirSeg(seg: string, cfg: Config): boolean;
/** True if seg is a hidden dir segment under cfg.HIDDEN_DIR_PREFIX. */
export declare function isHiddenDirSeg(seg: string, cfg: Config): boolean;
/**
 * Boundary: user input -> TemplateId.
 * (Does not validate; validation happens in parseTemplateIdPath)
 */
export declare function toTemplateId(raw: string): TemplateId;
/**
 * Parse TemplateId string to TemplateIdPath segments.
 * - Splits by "/"
 * - Rejects empty segments (e.g. "a//b", "/a", "a/")
 */
export declare function parseTemplateIdPath(id: TemplateId): TemplateIdPath;
/**
 * Extract (dirPath, tag) from TemplateIdPath.
 * tag is last segment, dir is everything before it.
 */
export declare function splitTemplateIdPath(p: TemplateIdPath): {
    dir: readonly string[];
    tag: TemplateTagName;
};
/**
 * Derive the “logical” segments from a filesystem-ish directory segment list:
 * - drops group dirs
 * - drops hidden dirs
 * - keeps ARRAY_SEG ("[]") because it is meaningful for array contributors
 */
export declare function deriveLogicalSegmentsFromDir(dirSegs: readonly string[], cfg: Config): readonly string[];
/**
 * Derive mount anchor path (object keys only; never includes ARRAY_SEG).
 * This answers: "theme/colors/[]/red mounts on ['theme','colors']".
 */
export declare function deriveMountAnchor(dirSegs: readonly string[], cfg: Config): TemplateAnchorPath;
/**
 * Determine whether a template is an array contributor based on its directory logical segments.
 * If it contains ARRAY_SEG, it contributes to an array at mount anchor.
 *
 * pushDepth = number of ARRAY_SEG segments after the mount anchor before the tag.
 * Example:
 *   colors/[]/red        => pushDepth=1
 *   colors/[]/[]/red     => pushDepth=2
 */
export declare function deriveArrayContribution(dirSegs: readonly string[], cfg: Config): {
    isArrayContributor: boolean;
    pushDepth: number;
};
/** Combine mount anchor + slotPath into a SlotAnchor. */
export declare function makeSlotAnchor(anchor: TemplateAnchorPath, slotPath: SlotPath): SlotAnchor;
/** Append an object key to a SlotPath. */
export declare function slotPathPushKey(slot: SlotPath, key: string): SlotPath;
/** Append ARRAY_SEG to a SlotPath to represent descending into an array element context. */
export declare function slotPathPushArray(slot: SlotPath): SlotPath;
export type ApplySelector = {
    kind: "plain";
    tag: TemplateTagName;
} | {
    kind: "grouped";
    group: GroupName;
    groupDir: GroupDirname;
    tag: TemplateTagName;
};
/**
 * Parse apply tag selector:
 * - "red" -> plain
 * - "dark::red" -> grouped
 *
 * Important: tagName MUST NOT be a path. This enforces your invariant.
 */
export declare function parseApplySelector(raw: string, cfg: Config): ApplySelector;
/**
 * Convert SlotPath to a filesystem-relative path segment list for apply resolution.
 * SlotPath must be interpreted literally as directories, including ARRAY_SEG.
 */
export declare function slotPathToFsRel(slotPath: SlotPath): FsRelPath;
/**
 * Build tPath segments for retrieveTemplate() from a slotPath + apply selector.
 * This returns a filesystem-relative tPath, *relative to the callerDirAbs*.
 *
 * Examples:
 *  slotPath=["style","color"], apply("red") -> ["style","color","red"]
 *  slotPath=["colors","[]"], apply("red")   -> ["colors","[]","red"]
 *  slotPath=["style","color"], apply("dark::red") -> ["style","color",".dark","red"]
 */
export declare function buildApplyTPath(slotPath: SlotPath, selector: ApplySelector): FsRelPath;
/**
 * Compute caller directory absolute path from TemplateContext pieces.
 * (templateDirAbs + caller.path segments)
 */
export declare function deriveCallerDirAbs(templateDir: TemplateDirAbs, callerPathSegs: readonly string[]): FsAbsPath;
/**
 * Convert templateDirAbs + FsRelPath -> FsAbsPath (file/dir).
 */
export declare function absFromTemplateDir(templateDir: TemplateDirAbs, rel: FsRelPath): FsAbsPath;
export declare function dbgTemplateIdPath(p: TemplateIdPath): string;
export declare function dbgMountAnchor(p: TemplateAnchorPath): string;
export declare function dbgSlotPath(p: SlotPath): string;
export declare function dbgSlotAnchor(p: SlotAnchor): string;
export declare function dbgFsRel(p: FsRelPath): string;
