import type { JsonObject, JsonValue, TemplateFunction, TemplateLiteral, TemplateNode, TemplateContext, ApplyThunk } from "./types";
import { TemplateDirAbs, FsRelPath, SlotPath } from "./types/brands";
export declare function retrieveTemplate(tPath: FsRelPath, // filesystem-relative segments (dirs + tag)
rootDirAbs: TemplateDirAbs): [template: TemplateFunction | TemplateLiteral, absPath: string];
export declare const apply: (tagNameRaw: string, args?: Record<string, unknown>) => ApplyThunk;
/**
 * Resolve a TemplateNode into a pure JsonValue.
 *
 * IMPORTANT:
 * - Arrays push ARRAY_SEG into slotPath (not numeric indices).
 * - This is the mechanism that makes apply() inside arrays resolve from .../[]/...
 */
export declare function resolveTemplateNode(node: TemplateNode, ctx: TemplateContext, nodePath: SlotPath): JsonValue;
export declare function render(templateIds: string[], args: Record<string, unknown>): JsonObject;
