export type Path = string[];
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
    [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {
}
export type Config = {
    templateDir: string;
    groupDirPrefix: string;
    LITERAL_EXT: string;
    TEMPLATE_EXT: string;
    HIDDEN_DIR_PREFIX: string;
};
export type SlotContext = {
    template: TemplateContext;
    slotPath: string[];
    slotAnchor: string[];
};
export type ApplyThunk = (slot: SlotContext) => JsonValue;
export type TemplateNode = JsonValue | ApplyThunk | {
    [key: string]: TemplateNode;
} | TemplateNode[];
export type TemplateContext = {
    id: string;
    anchor: string[];
    templateDir: string;
    path: Path;
    filename: string;
};
export type TemplateTools = {
    apply: (tagName: string, args: Record<string, unknown>) => ApplyThunk;
};
export type TemplateFunction = (args: Record<string, unknown>, ctx: TemplateContext, tools: TemplateTools) => TemplateNode;
export type TemplateLiteral = JsonValue;
export type Ctx = Record<string, any>;
export declare const isTemplateFunction: (fn: TemplateFunction | TemplateLiteral) => fn is TemplateFunction;
export declare const isTemplateLiteral: (v: TemplateFunction | TemplateLiteral) => v is TemplateLiteral;
