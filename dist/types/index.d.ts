import type { SlotPath, SlotAnchor, TemplateAnchorPath, TemplateId, TemplateDirAbs, FsRelPath, TemplateTagName } from "./brands";
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
    [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {
}
export type Config = {
    /** Absolute or relative; you will normalize this during config load. */
    templateDir: string;
    /** Group dir prefix (you said you use "." now). Example: "." -> ".dark" */
    groupDirPrefix: string;
    /** File extensions */
    LITERAL_EXT: string;
    TEMPLATE_EXT: string;
};
/**
 * The context passed into an ApplyThunk.
 *
 * NOTE:
 * - slotPath includes ARRAY_SEG markers (not numeric indices) when inside arrays.
 * - slotAnchor is template.anchor (keys-only) + slotPath (keys + ARRAY_SEG).
 */
export type SlotContext = {
    template: TemplateContext;
    /** Path inside this template's returned node. Includes "[]" for array descent. */
    slotPath: SlotPath;
    /** Absolute logical address: template.anchor + slotPath (includes "[]"). */
    slotAnchor: SlotAnchor;
};
export type ApplyThunk = (slot: SlotContext) => JsonValue;
/**
 * A TemplateNode is what templates are allowed to return.
 * It can contain ApplyThunks anywhere (objects, arrays, etc.).
 */
export type TemplateNode = JsonValue | ApplyThunk | {
    [key: string]: TemplateNode;
} | TemplateNode[];
/**
 * TemplateContext describes the currently executing template file.
 *
 * anchor:
 * - keys-only mount anchor (NO group dirs, NO hidden dirs, NO "[]")
 * - for array contributor templates, anchor is still keys-only (e.g. ["theme","colors"])
 *   while slotPath/slotAnchor carries the "[]" semantics.
 */
export type TemplateContext = {
    /** Template id as provided to render() or derived for apply() calls (for logs). */
    id: TemplateId;
    /** Logical mount anchor (keys-only). */
    anchor: TemplateAnchorPath;
    /** Absolute template root directory (normalized). */
    templateDir: TemplateDirAbs;
    /**
     * Filesystem-relative path from templateDir to this template's directory
     * INCLUDING group dirs / hidden dirs / "[]".
     *
     * Example: ["site", ".theme", "colors", "[]"]
     */
    path: FsRelPath;
    /** Template filename (not full path), e.g. "main.js" (if you want it). */
    filename: string;
};
export type TemplateTools = {
    /**
     * Apply a template by tag name (optionally group::tag), resolved relative
     * to the *slotPath* (object structure) and the caller's template directory.
     *
     * IMPORTANT: tagName is NOT a path.
     */
    apply: (tagName: string, args?: Record<string, unknown>) => ApplyThunk;
};
/**
 * TemplateFunction signature.
 * args is always a bag-of-named values (auditable).
 */
export type TemplateFunction = (args: Record<string, unknown>, ctx: TemplateContext, tools: TemplateTools) => TemplateNode;
export type TemplateLiteral = JsonValue;
export declare const isTemplateFunction: (fn: TemplateFunction | TemplateLiteral) => fn is TemplateFunction;
export declare const isTemplateLiteral: (v: TemplateFunction | TemplateLiteral) => v is TemplateLiteral;
export type RetrievedTemplate = {
    tag: TemplateTagName;
    template: TemplateFunction | TemplateLiteral;
    /** absolute path string to exact file; you can brand it FsAbsPath if you want */
    absPath: string;
};
