"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isArraySeg = exports.ARRAY_SEG = void 0;
exports.asObjPath = asObjPath;
exports.asTemplateAnchorPath = asTemplateAnchorPath;
exports.asSlotPath = asSlotPath;
exports.asSlotAnchor = asSlotAnchor;
exports.asFsRelPath = asFsRelPath;
exports.asTemplateIdPath = asTemplateIdPath;
exports.asTemplateId = asTemplateId;
exports.asTemplateTagName = asTemplateTagName;
exports.asGroupName = asGroupName;
exports.asGroupDirname = asGroupDirname;
exports.asFsAbsPath = asFsAbsPath;
exports.asTemplateDirAbs = asTemplateDirAbs;
exports.asFsDirname = asFsDirname;
exports.asFsFilename = asFsFilename;
exports.unwrapObjPath = unwrapObjPath;
exports.unwrapSlotPath = unwrapSlotPath;
exports.unwrapFsRelPath = unwrapFsRelPath;
exports.unwrapFsAbsPath = unwrapFsAbsPath;
exports.unwrapTemplateId = unwrapTemplateId;
exports.asFsString = asFsString;
exports.toObjPathStr = toObjPathStr;
exports.toTemplateAnchorStr = toTemplateAnchorStr;
exports.toSlotPathStr = toSlotPathStr;
exports.toSlotAnchorStr = toSlotAnchorStr;
exports.toFsRelPathStr = toFsRelPathStr;
exports.toTemplateIdStr = toTemplateIdStr;
exports.fsJoinAbs = fsJoinAbs;
exports.toFsAbsPathStr = toFsAbsPathStr;
exports.asString = asString;
const node_path_1 = __importDefault(require("node:path"));
/* =========================
 * Array segment marker
 * ========================= */
exports.ARRAY_SEG = "[]";
const isArraySeg = (s) => s === exports.ARRAY_SEG;
exports.isArraySeg = isArraySeg;
/* =========================
 * Boundary constructors (use sparingly)
 * ========================= */
function asObjPath(p) {
    return p;
}
function asTemplateAnchorPath(p) {
    return p;
}
function asSlotPath(p) {
    return p;
}
function asSlotAnchor(p) {
    return p;
}
function asFsRelPath(p) {
    return p;
}
function asTemplateIdPath(p) {
    return p;
}
function asTemplateId(s) {
    return s;
}
function asTemplateTagName(s) {
    return s;
}
function asGroupName(s) {
    return s;
}
function asGroupDirname(s) {
    return s;
}
function asFsAbsPath(p) {
    return p;
}
function asTemplateDirAbs(p) {
    return asFsAbsPath(p);
}
function asFsDirname(s) {
    return s;
}
function asFsFilename(s) {
    return s;
}
/* =========================
 * Unwrap helpers (explicit escape hatches)
 * ========================= */
function unwrapObjPath(p) {
    return p;
}
function unwrapSlotPath(p) {
    return p;
}
function unwrapFsRelPath(p) {
    return p;
}
function unwrapFsAbsPath(p) {
    return p;
}
function unwrapTemplateId(id) {
    return id;
}
/**
 * FS IO boundary helper: use ONLY when passing paths into fs APIs.
 * (Stricter alternative to `asString`.)
 */
function asFsString(p) {
    return unwrapFsAbsPath(p);
}
/* =========================
 * "/" joiners (typed, NO unions)
 * ========================= */
const joinSlash = (segs) => segs.join("/");
/** ObjPath/TemplateAnchorPath -> display string "a/b/c" */
function toObjPathStr(p) {
    return joinSlash(unwrapObjPath(p));
}
function toTemplateAnchorStr(p) {
    return joinSlash(unwrapObjPath(p));
}
/** SlotPath -> display string (may include "[]") */
function toSlotPathStr(p) {
    return joinSlash(unwrapSlotPath(p));
}
/** SlotAnchor -> display string (may include "[]") */
function toSlotAnchorStr(p) {
    return joinSlash(unwrapSlotPath(p));
}
/** FsRelPath -> display string */
function toFsRelPathStr(p) {
    return joinSlash(unwrapFsRelPath(p));
}
/** TemplateIdPath -> display string */
function toTemplateIdStr(p) {
    return joinSlash(p);
}
/* =========================
 * OS-path join helpers (typed)
 * ========================= */
/** Join OS paths and brand as FsAbsPath (safe for fs IO after unwrap). */
function fsJoinAbs(...parts) {
    return asFsAbsPath(node_path_1.default.join(...parts));
}
/** Mostly for logs; do not feed into fs without unwrap/asFsString. */
function toFsAbsPathStr(p) {
    return unwrapFsAbsPath(p);
}
/* =========================
 * Explicit "string boundary" helper
 * ========================= */
/**
 * Generic explicit escape hatch to plain JS string.
 * Prefer `asFsString()` for IO, and prefer the typed toXxxStr() for logs.
 */
function asString(s) {
    return s;
}
