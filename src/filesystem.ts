import * as _fs from "node:fs";
import * as path from "node:path";

import type { Config } from "./types/index";
import {
  asFsRelPath,
  asTemplateTagName,
  unwrapFsAbsPath,
  unwrapFsRelPath,
  FsRelPath,
  TemplateDirAbs,
  TemplateTagName,
  FsFilename,
  asFsFilename,
} from "./types/brands";

/**
 * Hidden file/dir prefix.
 *
 * IMPORTANT: We do NOT traverse these automatically.
 * If you set cfg.groupDirPrefix=".", then dot-dirs are groups (and therefore traversed),
 * but if you set cfg.groupDirPrefix to something else (e.g. "_"), dot-dirs are hidden
 * and will not be traversed.
 */
export const HIDDEN_FILE_PREFIX = "." as const;

/** Build literal filename from tag name. */
export const literalFilename = (
  tagName: TemplateTagName,
  cfg: Config
): FsFilename =>
  asFsFilename(`${tagName as unknown as string}${cfg.LITERAL_EXT}`);

/** Build function template filename from tag name. */
export const templateFilename = (
  tagName: TemplateTagName,
  cfg: Config
): FsFilename =>
  asFsFilename(`${tagName as unknown as string}${cfg.TEMPLATE_EXT}`);

/** Extract template tag name from filename (drops extension). */
export const tagNameFromFilename = (
  filename: string | FsFilename
): TemplateTagName => asTemplateTagName(path.parse(filename as string).name);

/**
 * True if entry is a “group dir” that should be traversed for implicit lookups.
 *
 * NOTE: We deliberately do NOT traverse hidden dirs here.
 * Hidden dirs are only “implicitly group dirs” when cfg.groupDirPrefix === "."
 * (because then they *are* group dirs).
 */
export const isGroupDir = (name: string, cfg: Config): boolean =>
  name.startsWith(cfg.groupDirPrefix);

/**
 * Find all matching files for (dirPath, tagName), searching through group dirs implicitly.
 *
 * Returns filesystem-relative paths (segments) from the template root directory:
 *   e.g. ["render",".a","look","default.json"]
 */
const _groupAgnosticFind =
  (fs: typeof _fs) =>
  (
    rootDir: TemplateDirAbs,
    dirPath: FsRelPath,
    tagName: TemplateTagName,
    cfg: Config
  ): FsRelPath[] => {
    const visit = (currentPath: string[], i: number): string[][] => {
      const hits: string[][] = [];

      const dirFsPath = path.join(unwrapFsAbsPath(rootDir), ...currentPath);
      if (!fs.existsSync(dirFsPath)) return hits;

      const entries = fs.readdirSync(dirFsPath, { withFileTypes: true });
      const anchorSegs = unwrapFsRelPath(dirPath);
      if (i === anchorSegs.length) {
        // Anchor fully matched.
        // 1) Prefer exact directory hits.
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (tagNameFromFilename(entry.name) === tagName) {
            hits.push([...currentPath, entry.name]);
          }
        }

        // If exact hits exist, do NOT infer group variants.
        if (hits.length > 0) {
          return hits;
        }

        // 2) Otherwise infer via group dirs at this anchor level.
        for (const entry of entries) {
          if (entry.isDirectory() && isGroupDir(entry.name, cfg)) {
            hits.push(...visit([...currentPath, entry.name], i));
          }
        }

        return hits;
      }

      const segment = anchorSegs[i];

      // Not done matching anchor segments yet:
      // - follow exact segment matches
      // - also traverse into group dirs without consuming anchor segments
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        if (entry.name === segment) {
          hits.push(...visit([...currentPath, entry.name], i + 1));
        } else if (isGroupDir(entry.name, cfg)) {
          hits.push(...visit([...currentPath, entry.name], i));
        }
      }

      return hits;
    };

    const rawHits = visit([], 0);
    return rawHits.map((h) => asFsRelPath(h));
  };

export const groupAgnosticFindWithFs = _groupAgnosticFind;
export const groupAgnosticFind = _groupAgnosticFind(_fs);
