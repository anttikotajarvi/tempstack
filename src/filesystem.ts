import * as _fs from "fs";
import * as path from "path";
import { Config, Path } from "./types";
export const HIDDEN_FILE_PREFIX = ".";


export const literalFilename = (tagName: string) => `${tagName}.json`;
export const templateFilename = (tagName: string) => `${tagName}.js`;
export const tagNameFromFilename = (filename: string): string => {
  path.extname(filename);
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);

  return basename;
}


const _groupAgnosticFind = (fs: typeof _fs) => (dirPath: Path, tagName: string, cfg: Config): Path[] => {
  const visit = (currentPath: Path, i: number): Path[] => {
    const hits: Path[] = [];
    const dirFsPath = path.join(cfg.templateDir, ...currentPath);
    if (!fs.existsSync(dirFsPath)) {
      return hits;
    }

    const entries = fs.readdirSync(dirFsPath, { withFileTypes: true });

    if (i === dirPath.length) {
      // We've matched all anchor segments for dirPath.
      // 1) Collect files with matching tagName in this directory.
      for (const entry of entries) {
        if (entry.isFile()) {
          if (tagNameFromFilename(entry.name) === tagName) {
            hits.push([...currentPath, entry.name]);
          }
        }
      }
      // 2) Recurse into group dirs without advancing i (still same anchor level).
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          (entry.name.startsWith(cfg.groupDirPrefix) ||
            entry.name.startsWith(HIDDEN_FILE_PREFIX))
        ) {
          hits.push(...visit([...currentPath, entry.name], i));
        }
      }
      return hits;
    }

    const segment = dirPath[i];

    // We haven't matched all anchor segments yet.
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      if (entry.name === segment) {
        // This directory matches the next anchor segment:
        // consume one segment and recurse.
        hits.push(...visit([...currentPath, entry.name], i + 1));
      } else if (
        entry.name.startsWith(cfg.groupDirPrefix) ||
        entry.name.startsWith(HIDDEN_FILE_PREFIX)
      ) {
        // Group dir: we don't consume an anchor segment,
        // just recurse with same i.
        hits.push(...visit([...currentPath, entry.name], i));
      }
    }

    return hits;
  };

  return visit([], 0);
}

export const groupAgnosticFindWithFs = _groupAgnosticFind;