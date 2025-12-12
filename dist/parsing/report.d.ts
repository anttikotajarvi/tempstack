import { Config, TemplateFunction } from "../types";
import { TemplateTreeRep } from "../types/report";
/**
 * Heuristic: run the template with a proxy args object that records accessed keys.
 */
export declare function getUsedArguments(tFn: TemplateFunction): string[];
/**
 * Public entry point: build complete TemplateTreeRep from cfg.
 */
export declare function buildTemplateTree(cfg: Config): TemplateTreeRep;
