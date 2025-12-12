import { JsonObject, JsonValue } from "./types";
export declare function splitPath(filePath: string): string[];
export declare function isJsonObject(v: JsonValue): v is JsonObject;
export declare function deepMergeObjects(a: JsonObject, b: JsonObject): JsonObject;
