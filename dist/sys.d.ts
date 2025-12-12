import { JsonObject, JsonValue, TemplateContext, TemplateFunction, TemplateLiteral, TemplateNode } from "./types";
export declare function retrieveTemplate(tPath: string[], root: string): [template: TemplateFunction | TemplateLiteral, absolutePath: string];
export declare function resolveTemplateNode(node: TemplateNode, ctx: TemplateContext, nodePath: string[]): JsonValue;
export declare function render(templateIds: string[], args: Record<string, unknown>): JsonObject;
