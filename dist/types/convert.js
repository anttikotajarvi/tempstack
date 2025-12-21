"use strict";
// src/types/convert.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.setErr = setErr;
exports.isGroupDirSeg = isGroupDirSeg;
exports.isHiddenDirSeg = isHiddenDirSeg;
exports.toTemplateId = toTemplateId;
exports.parseTemplateIdPath = parseTemplateIdPath;
exports.splitTemplateIdPath = splitTemplateIdPath;
exports.deriveLogicalSegmentsFromDir = deriveLogicalSegmentsFromDir;
exports.deriveMountAnchor = deriveMountAnchor;
exports.deriveArrayContribution = deriveArrayContribution;
exports.makeSlotAnchor = makeSlotAnchor;
exports.slotPathPushKey = slotPathPushKey;
exports.slotPathPushArray = slotPathPushArray;
exports.parseApplySelector = parseApplySelector;
exports.slotPathToFsRel = slotPathToFsRel;
exports.buildApplyTPath = buildApplyTPath;
exports.deriveCallerDirAbs = deriveCallerDirAbs;
exports.absFromTemplateDir = absFromTemplateDir;
exports.dbgTemplateIdPath = dbgTemplateIdPath;
exports.dbgMountAnchor = dbgMountAnchor;
exports.dbgSlotPath = dbgSlotPath;
exports.dbgSlotAnchor = dbgSlotAnchor;
exports.dbgFsRel = dbgFsRel;
const filesystem_1 = require("../filesystem");
const brands_1 = require("./brands");
const brands_2 = require("./brands");
/* ============================================================
 * Utilities (internal)
 * ============================================================ */
let err = (code, msg) => {
    throw new Error(`${code}: ${msg}`);
};
function setErr(fn) {
    err = fn;
}
/** True if seg is a group directory segment under cfg.groupDirPrefix. */
function isGroupDirSeg(seg, cfg) {
    return seg.startsWith(cfg.groupDirPrefix);
}
/** True if seg is a hidden dir segment under cfg.HIDDEN_DIR_PREFIX. */
function isHiddenDirSeg(seg, cfg) {
    return seg.startsWith(filesystem_1.HIDDEN_FILE_PREFIX);
}
/** Disallow slashes in a segment. */
function assertNoSlash(seg, what) {
    if (seg.includes("/") || seg.includes("\\")) {
        err("invalid-segment", `${what} must not contain path separators: '${seg}'`);
    }
}
/** Disallow explicit file extensions in template tags (rule: no-explicit-file-types). */
function assertNoExplicitExt(tag, cfg) {
    if (tag.endsWith(cfg.LITERAL_EXT) || tag.endsWith(cfg.TEMPLATE_EXT)) {
        err("no-explicit-file-types", `Template tag must not include file extension: '${tag}'`);
    }
}
/* ============================================================
 * TemplateId parsing / formatting
 * ============================================================ */
/**
 * Boundary: user input -> TemplateId.
 * (Does not validate; validation happens in parseTemplateIdPath)
 */
function toTemplateId(raw) {
    return (0, brands_2.asTemplateId)(raw);
}
/**
 * Parse TemplateId string to TemplateIdPath segments.
 * - Splits by "/"
 * - Rejects empty segments (e.g. "a//b", "/a", "a/")
 */
function parseTemplateIdPath(id) {
    const raw = (0, brands_2.unwrapTemplateId)(id).trim();
    if (raw.length === 0) {
        err("invalid-template-id", "TemplateId is empty");
    }
    const segs = raw.split("/").map((s) => s.trim());
    if (segs.some((s) => s.length === 0)) {
        err("invalid-template-id", `TemplateId has empty segments: '${raw}'`);
    }
    // Optional: forbid "." / ".." segments entirely
    if (segs.some((s) => s === "." || s === "..")) {
        err("invalid-template-id", `TemplateId must not contain '.' or '..': '${raw}'`);
    }
    return (0, brands_2.asTemplateIdPath)(segs);
}
/**
 * Extract (dirPath, tag) from TemplateIdPath.
 * tag is last segment, dir is everything before it.
 */
function splitTemplateIdPath(p) {
    const segs = p;
    if (segs.length === 0) {
        err("invalid-template-id", "TemplateIdPath is empty");
    }
    const dir = segs.slice(0, -1);
    const tagRaw = segs[segs.length - 1];
    return { dir, tag: (0, brands_2.asTemplateTagName)(tagRaw) };
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
function deriveLogicalSegmentsFromDir(dirSegs, cfg) {
    return dirSegs.filter((seg) => !isGroupDirSeg(seg, cfg) && !isHiddenDirSeg(seg, cfg));
}
/**
 * Derive mount anchor path (object keys only; never includes ARRAY_SEG).
 * This answers: "theme/colors/[]/red mounts on ['theme','colors']".
 */
function deriveMountAnchor(dirSegs, cfg) {
    const logical = deriveLogicalSegmentsFromDir(dirSegs, cfg);
    const firstArrayIdx = logical.findIndex((s) => (0, brands_2.isArraySeg)(s));
    const keyPart = firstArrayIdx === -1 ? logical : logical.slice(0, firstArrayIdx);
    // For mount anchor, forbid ARRAY_SEG and forbid empty
    return (0, brands_2.asTemplateAnchorPath)(keyPart);
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
function deriveArrayContribution(dirSegs, cfg) {
    const logical = deriveLogicalSegmentsFromDir(dirSegs, cfg);
    const firstArrayIdx = logical.findIndex((s) => (0, brands_2.isArraySeg)(s));
    if (firstArrayIdx === -1)
        return { isArrayContributor: false, pushDepth: 0 };
    // Count consecutive [] segments from firstArrayIdx onward
    let depth = 0;
    for (let i = firstArrayIdx; i < logical.length; i++) {
        if ((0, brands_2.isArraySeg)(logical[i]))
            depth++;
        else
            break;
    }
    return { isArrayContributor: true, pushDepth: depth };
}
/* ============================================================
 * Slot path / slot anchor derivation
 * ============================================================ */
/** Combine mount anchor + slotPath into a SlotAnchor. */
function makeSlotAnchor(anchor, slotPath) {
    const a = (0, brands_2.unwrapObjPath)(anchor);
    const s = (0, brands_2.unwrapSlotPath)(slotPath);
    return (0, brands_2.asSlotAnchor)([...a, ...s]);
}
/** Append an object key to a SlotPath. */
function slotPathPushKey(slot, key) {
    assertNoSlash(key, "Slot key");
    const s = (0, brands_2.unwrapSlotPath)(slot);
    return (0, brands_2.asSlotPath)([...s, key]);
}
/** Append ARRAY_SEG to a SlotPath to represent descending into an array element context. */
function slotPathPushArray(slot) {
    const s = (0, brands_2.unwrapSlotPath)(slot);
    return (0, brands_2.asSlotPath)([...s, brands_2.ARRAY_SEG]);
}
/**
 * Parse apply tag selector:
 * - "red" -> plain
 * - "dark::red" -> grouped
 *
 * Important: tagName MUST NOT be a path. This enforces your invariant.
 */
function parseApplySelector(raw, cfg) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        err("invalid-template-id", "apply() tagName is empty");
    }
    // forbid slashes outright
    assertNoSlash(trimmed, "apply() selector");
    const sepIdx = trimmed.indexOf("::");
    if (sepIdx === -1) {
        assertNoExplicitExt(trimmed, cfg);
        return { kind: "plain", tag: (0, brands_2.asTemplateTagName)(trimmed) };
    }
    const groupPart = trimmed.slice(0, sepIdx).trim();
    const tagPart = trimmed.slice(sepIdx + 2).trim();
    if (!groupPart || !tagPart) {
        err("invalid-template-id", `Invalid group selector syntax: '${trimmed}'`);
    }
    assertNoExplicitExt(tagPart, cfg);
    // In your spec: group selector uses cfg.groupDirPrefix ONLY, not hidden prefix.
    const group = groupPart;
    const groupDir = (cfg.groupDirPrefix + groupPart);
    return {
        kind: "grouped",
        group,
        groupDir,
        tag: (0, brands_2.asTemplateTagName)(tagPart)
    };
}
/* ============================================================
 * Apply resolution path construction
 * ============================================================ */
/**
 * Convert SlotPath to a filesystem-relative path segment list for apply resolution.
 * SlotPath must be interpreted literally as directories, including ARRAY_SEG.
 */
function slotPathToFsRel(slotPath) {
    const s = (0, brands_2.unwrapSlotPath)(slotPath);
    return (0, brands_2.asFsRelPath)([...s]);
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
function buildApplyTPath(slotPath, selector) {
    const base = (0, brands_1.unwrapFsRelPath)(slotPathToFsRel(slotPath));
    const out = [...base];
    if (selector.kind === "grouped") {
        out.push(selector.groupDir);
    }
    out.push(selector.tag);
    return (0, brands_2.asFsRelPath)(out);
}
/* ============================================================
 * Filesystem absolute path derivations
 * ============================================================ */
/**
 * Compute caller directory absolute path from TemplateContext pieces.
 * (templateDirAbs + caller.path segments)
 */
function deriveCallerDirAbs(templateDir, callerPathSegs) {
    return (0, brands_2.fsJoinAbs)((0, brands_2.unwrapFsAbsPath)(templateDir), ...callerPathSegs);
}
/**
 * Convert templateDirAbs + FsRelPath -> FsAbsPath (file/dir).
 */
function absFromTemplateDir(templateDir, rel) {
    return (0, brands_2.fsJoinAbs)((0, brands_2.unwrapFsAbsPath)(templateDir), ...(0, brands_1.unwrapFsRelPath)(rel));
}
/* ============================================================
 * Debug / log helpers (explicit, typed)
 * ============================================================ */
function dbgTemplateIdPath(p) {
    return (0, brands_2.toTemplateIdStr)(p);
}
function dbgMountAnchor(p) {
    return (0, brands_2.toObjPathStr)(p);
}
function dbgSlotPath(p) {
    return (0, brands_2.toSlotPathStr)(p);
}
function dbgSlotAnchor(p) {
    return (0, brands_2.toSlotAnchorStr)(p);
}
function dbgFsRel(p) {
    return (0, brands_2.toFsRelPathStr)(p);
}
