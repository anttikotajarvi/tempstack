import * as _fs from "node:fs";
import type { Config } from "./types/index";
import { FsRelPath, TemplateDirAbs, TemplateTagName, FsFilename } from "./types/brands";
/**
 * Hidden file/dir prefix.
 *
 * IMPORTANT: We do NOT traverse these automatically.
 * If you set cfg.groupDirPrefix=".", then dot-dirs are groups (and therefore traversed),
 * but if you set cfg.groupDirPrefix to something else (e.g. "_"), dot-dirs are hidden
 * and will not be traversed.
 */
export declare const HIDDEN_FILE_PREFIX: ".";
/** Build literal filename from tag name. */
export declare const literalFilename: (tagName: TemplateTagName, cfg: Config) => FsFilename;
/** Build function template filename from tag name. */
export declare const templateFilename: (tagName: TemplateTagName, cfg: Config) => FsFilename;
/** Extract template tag name from filename (drops extension). */
export declare const tagNameFromFilename: (filename: string | FsFilename) => TemplateTagName;
/**
 * True if entry is a “group dir” that should be traversed for implicit lookups.
 *
 * NOTE: We deliberately do NOT traverse hidden dirs here.
 * Hidden dirs are only “implicitly group dirs” when cfg.groupDirPrefix === "."
 * (because then they *are* group dirs).
 */
export declare const isGroupDir: (name: string, cfg: Config) => boolean;
export declare const groupAgnosticFindWithFs: (fs: typeof _fs) => (rootDir: TemplateDirAbs, dirPath: FsRelPath, tagName: TemplateTagName, cfg: Config) => FsRelPath[];
export declare const groupAgnosticFind: (rootDir: TemplateDirAbs, dirPath: FsRelPath, tagName: TemplateTagName, cfg: Config) => FsRelPath[];
