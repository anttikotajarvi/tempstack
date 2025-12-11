import { Config, JsonValue, Path } from ".";

type TTLoc = {
  /**
   * Name of this node:
   * - For directories: directory name (e.g. "site", ".a"), "" for root
   * - For templates: filename without extension (e.g. "layout", "primary")
   */
  name: string;

  /**
   * Path segments inside templateDir, without extensions, including group/hidden dirs.
   *
   * Examples:
   *   root dir: []
   *   /templates/site           -> ["site"]
   *   /templates/site/style     -> ["site","style"]
   *   /templates/site/style/layout.json -> ["site","style","layout"]
   *   /templates/site/style/.dark/primary.json -> ["site","style",".dark","primary"]
   */
  localPath: Path;

  /**
   * Absolute filesystem path to this node:
   * - For directories: directory path
   * - For templates: full file path including extension
   *
   * This should be treated as opaque and only used for actual fs I/O,
   * not for building logical IDs or anchors.
   */
  fsPath: string;
};

/**
 * Literal template node
 */
type TTLiteralLog = TTLoc & {
  nodeType: "template-literal";

  /** Logical anchor path this literal writes into (no group/hidden dirs, no filename). */
  anchor: string[]; // e.g. ["site","style","color"]

  /** Parsed literal content (can be scalar, array, or object). */
  content: JsonValue;
};

/** 
 * Function template node
 */
type TTFunctionLog = TTLoc & {
  nodeType: "template-function";

  /** Logical anchor path this function template writes into. */
  anchor: string[];

  /** Full file content (for UI / inspection). */
  content: string;

  /** Heuristically discovered argument keys (from getUsedArguments). */
  args: string[];

  /** Does this template call apply() anywhere? */
  usesApply: boolean;
};

/**
 * Directory node
 */

type TTDir = TTLoc & {
    nodeType: "dir";
    
    /** Root, anchor, group, or hidden */
    dirType: TTDirType;
    
    /**
     * Contribution to anchor path:
     * - "anchor-dir": usually [name]
     * - "group-dir" / "hidden-dir": usually []
     * - "root": []
    *
    * A template's anchor is typically:
    *   concat of all ancestor.dirAnchor plus file-level anchor logic.
    */
   dirAnchor: string[];
   
   /** Children of this directory, keyed by child.name (not fsName). */
   children: Record<string, TTNode>;
};
type TTDirType = "root" | "anchor-dir" | "group-dir" | "hidden-dir";

type TTNode = TTLiteralLog | TTFunctionLog | TTDir;


    /**
     * Final template tree log structure
     */
    type TemplateTreeRep = {
        cfg: Config,

        /** Tree of nodes starting from root */
        tree: TTDir;
    };

export type { TTLoc, TTLiteralLog, TTFunctionLog, TTDir, TTNode, TTDirType, TemplateTreeRep };