export type Path = string[];
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {}

export type Config = {
  templateDir: string;
  groupDirPrefix: string;

  LITERAL_EXT: string;
  TEMPLATE_EXT: string;

  HIDDEN_DIR_PREFIX: string;
}

export type SlotContext = {
  template: TemplateContext;
  slotPath: string[];   // path inside this template's result, e.g. ["colorManagement"]
  slotAnchor: string[]; // absolute logical path: template.anchor + slotPath
};

export type ApplyThunk = (slot: SlotContext) => JsonValue;

export type TemplateNode =
  | JsonValue // normal JSON value
  | ApplyThunk // deferred apply
  | { [key: string]: TemplateNode } // nested object
  | TemplateNode[]; // arrays of nodes

export type TemplateContext = {
  id: string;           // tid                       (e.g. "template")
  anchor: string[];     // logical anchor segments   (e.g. ["render","look"])
  templateDir: string;  // fs path to template's dir (e.g. "/home/user/project/templates")
  path: Path;           // fs path segments to template's dir (e.g. ["render",".a","look"])
  filename: string;     // template filename        (e.g. "template.js")
  
};
export type TemplateTools = {
  apply: (tagName: string, args: Record<string, unknown>) => ApplyThunk;
};
export type TemplateFunction = (
  args: Record<string, unknown>,
  ctx: TemplateContext,
  tools: TemplateTools
) => TemplateNode;

export type TemplateLiteral = JsonValue;
export type Ctx = Record<string, any>;

export const isTemplateFunction = (
  fn: TemplateFunction | TemplateLiteral
): fn is TemplateFunction => {
  return typeof fn === "function";
};
export const isTemplateLiteral = (
  v: TemplateFunction | TemplateLiteral
): v is TemplateLiteral => {
   return !isTemplateFunction(v);
};
