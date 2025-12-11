const cfg: Config = {
  templateDir: path.join(__dirname, "test-templates"),
  groupDirPrefix: "_",
  
  LITERAL_EXT: ".json",
  TEMPLATE_EXT: ".js",

  HIDDEN_DIR_PREFIX: "."
};

import { describe, it, expect } from "vitest";
import { Config } from "../src/types";
import { buildTemplateTree } from "../src/parsing/report";
import path from "path";

describe("buildTemplateTree()", () => {
    it("builds a template tree from the config", () => {
        const tree = buildTemplateTree(cfg);
        console.log(JSON.stringify(tree, null, 2));
        expect(tree).toBeDefined();
    });
});
