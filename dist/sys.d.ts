import type { Config, JsonObject, JsonValue, TemplateFunction, TemplateLiteral, TemplateNode, TemplateContext, ApplyThunk } from "./types";
import { TemplateDirAbs, FsAbsPath, FsRelPath } from "./types/brands";
export declare enum ERROR_CODES {
    INVALID_TEMPLATE_ID = "invalid-template-id",
    NO_EXPLICIT_FILE_TYPES = "no-explicit-file-types",
    NO_DUPLICATE_TEMPLATES = "no-duplicate-templates",
    TEMPLATE_NOT_FOUND = "template-not-found",
    AMBIGIGUOUS_TEMPLATE_NAME = "ambiguous-template-name",
    INVALID_TEMPLATE_TYPE = "invalid-template-type",
    INVALID_TEMPLATE_ARGS = "invalid-template-args",
    TEMPLATE_EXECUTION_ERROR = "template-execution-error",
    INVALID_ANCHOR = "invalid-anchor",
    ARRAY_TYPE_MISMATCH = "array-type-mismatch",
    UNEXPECTED_READ_ERROR = "unexpected-read-error",
    INVALID_OVERRIDE = "invalid-override",
    INVALID_PATCH = "invalid-patch"
}
export declare function retrieveTemplate(tPath: FsRelPath, rootDirAbs: TemplateDirAbs | FsAbsPath, cfg: Config): [template: TemplateFunction | TemplateLiteral, absolutePath: FsAbsPath];
export declare const apply: (tagName: string, args?: Record<string, unknown>) => ApplyThunk;
export declare function resolveTemplateNode(node: TemplateNode, ctx: TemplateContext, nodePath: FsRelPath): JsonValue;
export declare function render(templateIds: string[], args: Record<string, unknown>): JsonObject;
