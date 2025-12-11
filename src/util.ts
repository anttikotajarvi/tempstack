import * as path from "path";
import { JsonObject, JsonValue } from "./types";
export function splitPath(filePath:string): string[] {
  const { root, dir, base } = path.parse(filePath);

  const parts: string[] = [];

  // Keep the root ("/", "C:\\", "\\\\server\\share\\", etc.)
  if (root) parts.push(root);

  // dir without root (e.g. "home/user" from "/home/user")
  const dirWithoutRoot =
    dir && root && dir.startsWith(root) ? dir.slice(root.length) : dir;

  if (dirWithoutRoot) {
    parts.push(
      ...dirWithoutRoot
        .split(path.sep)
        .filter(Boolean) // removes empty strings
    );
  }

  // Finally, the file/last segment name
  if (base) parts.push(base);

  return parts;
}

export function isJsonObject(v: JsonValue): v is JsonObject {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function deepMergeObjects(a: JsonObject, b: JsonObject): JsonObject {
  // placeholder – you’ll implement real merge rules later
  const out: JsonObject = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isJsonObject(v) && isJsonObject(out[k] as JsonValue)) {
      out[k] = deepMergeObjects(out[k] as JsonObject, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}