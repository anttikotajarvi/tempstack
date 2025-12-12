import * as _fs from "fs";
import { Config, Path } from "./types";
export declare const HIDDEN_FILE_PREFIX = ".";
export declare const literalFilename: (tagName: string) => string;
export declare const templateFilename: (tagName: string) => string;
export declare const tagNameFromFilename: (filename: string) => string;
export declare const groupAgnosticFindWithFs: (fs: typeof _fs) => (dirPath: Path, tagName: string, cfg: Config) => Path[];
