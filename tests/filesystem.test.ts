// tests/groupAgnosticFind.test.ts
import path from "node:path";
import { describe, it, expect } from "vitest";

import { groupAgnosticFind } from "../src/filesystem";
import type { Config } from "../src/types";

import {
  asTemplateDirAbs,
  asFsRelPath,
  asTemplateTagName,
  unwrapFsRelPath
} from "../src/types/brands";

const TEMPLATE_ROOT = path.resolve(process.cwd(), "tests", "test-templates");

const cfg: Config = {
  templateDir: TEMPLATE_ROOT,
  groupDirPrefix: ".",
  LITERAL_EXT: ".json",
  TEMPLATE_EXT: ".js",
};

const asSegs = (hits: any[]): string[][] => hits.map((h) => unwrapFsRelPath(h) as any as string[]);

describe("groupAgnosticFind (real filesystem)", () => {
  it("finds a simple template in a normal anchor dir (site/style/color/primary.json)", () => {
    const hits = groupAgnosticFind(
      asTemplateDirAbs(TEMPLATE_ROOT),
      asFsRelPath(["site", "style", "color"]),
      asTemplateTagName("primary"),
      cfg
    );

    expect(asSegs(hits)).toEqual([["site", "style", "color", "primary.json"]]);
  });

  it("finds a template inside an explicit [] directory (array-tests/colors/[]/red.json)", () => {
    const hits = groupAgnosticFind(
      asTemplateDirAbs(TEMPLATE_ROOT),
      asFsRelPath(["array-tests", "colors", "[]"]),
      asTemplateTagName("red"),
      cfg
    );

    expect(asSegs(hits)).toEqual([["array-tests", "colors", "[]", "red.json"]]);
  });

  it("finds a template inside deeper nested []/[] (array-tests/nested/[]/[]/a.json)", () => {
    const hits = groupAgnosticFind(
      asTemplateDirAbs(TEMPLATE_ROOT),
      asFsRelPath(["array-tests", "nested", "[]", "[]"]),
      asTemplateTagName("a"),
      cfg
    );

    expect(asSegs(hits)).toEqual([["array-tests", "nested", "[]", "[]", "a.json"]]);
  });

  it("returns empty when nothing matches", () => {
    const hits = groupAgnosticFind(
      asTemplateDirAbs(TEMPLATE_ROOT),
      asFsRelPath(["site", "style"]),
      asTemplateTagName("definitely-does-not-exist"),
      cfg
    );

    expect(asSegs(hits)).toEqual([]);
  });

  it("does not confuse tag names across extensions (site.js is NOT a tag inside site/ dir)", () => {
    // This ensures we're searching inside "site/" directory, not the root file "site.js".
    const hits = groupAgnosticFind(
      asTemplateDirAbs(TEMPLATE_ROOT),
      asFsRelPath(["site"]),
      asTemplateTagName("site"), // would match site.js only if we were in root
      cfg
    );

    expect(asSegs(hits)).toEqual([]); // there is no site/site.(js|json)
  });
});
