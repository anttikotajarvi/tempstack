// tests/render.test.ts
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "../src";
import { Config } from "../src/types";
import { initConfig, resetConfig } from "../src/config";
import { version } from "node:os";

const cfg: Config = {
  templateDir: path.join(__dirname, "test-templates"),
  groupDirPrefix: ".",
  LITERAL_EXT: ".json",
  TEMPLATE_EXT: ".js",
};

describe("render()", () => {
  beforeEach(() => {
    // make sure we don't reuse an old cached config
    resetConfig();
    // set the global config for this test run
    initConfig(cfg);
  });

  it("returns an empty object when no templates are provided", () => {
    const result = render([], {});
    expect(result).toEqual({});
  });

  it("merges a literal template under the correct anchor (site/style/layout)", () => {
    const result = render(["site/style/layout"], {});

    expect(result).toEqual({
      site: {
        style: {
          layout: "compact",
        },
      },
    });
  });

  it("applies top-level template 'site' and resolves nested apply chain", () => {
    const result = render(["site"], {
      title: "My Site",
      heroTitle: "Custom Hero",
    });

    expect(result).toEqual({
      site: {
        // from args.title
        title: "My Site",

        style: {
          // via apply("primary") at ["site","style","color"]
          // => /site/style/color/primary.json
          color: "red",

          // via apply("dark::primary") at ["site","style","darkColor"]
          // => /site/style/darkColor/.dark/primary.json
          darkColor: "darkred",
        },

        hero: {
          // from heroTheme.js (args.heroTitle)
          title: "Custom Hero",

          theme: {
            // from nested apply("colors::main") at ["theme","color"]
            // with ctx.path = ["site","hero"]
            // => /site/hero/theme/color/.colors/main.json
            color: "gold",
          },
        },
      },
    });
  });

  it("merges multiple templates into the same anchor", () => {
    const result = render(["site", "site/style/layout"], {
      title: "Combined Site",
    });

    expect(result).toEqual({
      site: {
        title: "Combined Site",
        style: {
          color: "red",
          darkColor: "darkred",
          layout: "compact",
        },
        hero: {
          title: "Hero From Template",
          theme: {
            color: "gold",
          },
        },
      },
    });
  });

  it("passes parameters into a simple template without apply (site/params)", () => {
    const result = render(["site/params"], {
      env: "prod",
      debug: true,
    });

    expect(result).toEqual({
      site: {
        flags: {
          env: "prod",
          debug: true,
        },
      },
    });
  });

  it("passes parameters into nested templates resolved via apply", () => {
    const result = render(["site"], {
      title: "Param Site",
      heroTitle: "Hero With Args",
    });

    expect((result.site as any)?.hero?.title).toBe("Hero With Args");
  });

  it("resolves templates that read from parallel paths", () => {
    const result = render(["version/readFromParallel"], {});

    expect(result).toEqual({
      version: "0.0.1",
    });
  });

  // --- shorthand & ambiguity / invalid IDs ---

  it("resolves shorthand to a single-group template (config/settings -> .only/settings.json)", () => {
    const result = render(["config/settings"], {});

    expect(result).toEqual({
      config: {
        mode: "only",
        enabled: true,
      },
    });
  });

  it("throws for an ambiguous shorthand when multiple group dirs contain the same tag", () => {
    // config/.a/feature.json and config/.b/feature.json both present
    expect(() => render(["config/feature"], {})).toThrow(
      /ambiguous-template-name|template-not-found|multiple matches/i
    );
  });

  it("throws for invalid template IDs with explicit file extensions", () => {
    // tagName ending with .json or .js should trigger no-explicit-file-types
    expect(() => render(["site/style/layout.json"], {})).toThrow(
      /no-explicit-file-types/i
    );
    expect(() => render(["site.js"], {})).toThrow(/no-explicit-file-types/i);
  });

  it("throws for an empty template ID", () => {
    // depends on how splitPath("") behaves; if it yields [], we hit INVALID_TEMPLATE_ID
    expect(() => render([""], {})).toThrow(/invalid-template-id/i);
  });
});

// Array tests
describe("render() array semantics ([] anchors)", () => {
  beforeEach(() => {
    // make sure we don't reuse an old cached config
    resetConfig();
    // set the global config for this test run
    initConfig(cfg);
  });

  it("pushes elements from prop/[] templates into the parent array slot", () => {
    const result = render(
      ["array-tests/colors/[]/red", "array-tests/colors/[]/blue"],
      {}
    );

    expect(result).toEqual({
      "array-tests": {
        colors: ["red", "blue"],
      },
    });
  });

  it("allows whole-slot array template then pushes [] elements after it", () => {
    const result = render(
      ["array-tests/colors/default", "array-tests/colors/[]/red"],
      {}
    );

    expect(result).toEqual({
      "array-tests": {
        colors: ["base", "red"],
      },
    });
  });

  it("throws when applying prop/[] element template to a non-array slot", () => {
    expect(() =>
      render(["array-tests/colors/scalar", "array-tests/colors/[]/red"], {})
    ).toThrow(/array|\[\]|push|non-array|type/i);
  });

  it("apply() inside an array resolves from slot/[]/tag and supports group::tag (groupDirPrefix='.')", () => {
    const result = render(["array-tests/colors/arrayApply"], {});
    expect(result).toEqual({
      "array-tests": {
        colors: ["red", "blue", "dark-red"],
      },
    });
  });

  it("pushes returned arrays as single elements (no flatten): element returns array => nested array", () => {
    const result = render(["array-tests/colors/[]/palette"], {});
    expect(result).toEqual({
      "array-tests": {
        colors: [["p1", "p2"]],
      },
    });
  });

  it("nested [] produces arrays-of-arrays; repeated nested [] templates create separate inner arrays", () => {
    const result = render(
      ["array-tests/nested/[]/[]/a", "array-tests/nested/[]/[]/b"],
      {}
    );

    expect(result).toEqual({
      "array-tests": {
        nested: [["a1"], ["b1"]],
      },
    });
  });

  it("mixing base whole-slot + [] push works on a different anchor", () => {
    const result = render(
      ["array-tests/mix/base", "array-tests/mix/[]/plus"],
      {}
    );

    expect(result).toEqual({
      "array-tests": {
        mix: ["m0", "m1"],
      },
    });
  });

  it("invalid template id with root [] segment throws invalid-id style error (not just mismatch)", () => {
    expect(() => render(["array-tests/[]/red"], {})).toThrow(/invalid|\[\]/i);
  });
});

// Override tests
describe("__override arguments", () => {
  beforeEach(() => {
    // make sure we don't reuse an old cached config
    resetConfig();
    // set the global config for this test run
    initConfig(cfg);
  });

  it("override replaces existing fields", () => {
    const result = render(["config/.a/feature"], {
      __override: {
        config: {
          from: "override value",
        },
      },
    });
    expect(result).toEqual({
      config: {
        from: "override value",
      },
    });
  });

  it("override adds new fields", () => {
    const result = render(["version/old"], {
      __override: {
        newField: "override value"
      },
    });
    expect(result).toEqual({
      version: "0.0.1", // From version/old.json
      newField: "override value"
    });
  });

  it("override deepmerges partial values", () => {
    const result = render(["config/.a/feature"], {
      __override: {
        config: {
          newField: "override value",
        },
      },
    });
    expect(result).toEqual({
      config: {
        from: "override value",
        newField: "override value", // Overrides are merged last thus this order
      },
    });
  });

  it("override replaces replaces arrays", () => {
    const result = render(
      [
        "array-tests/colors/default", // Yields ["base"]
      ],
      {
        __override: {
          "array-tests": {
            colors: ["pink", "purple"],
          },
        },
      }
    );
    expect(result).toEqual({
      "array-tests": {
        colors: ["pink", "purple"],
      },
    });
  });

  it("override allows array-contributors", () => {
    const result = render(["array-tests/colors/default"], {
      __override: {
        "array-tests": {
          colors: "[]"
        },
      },
    });
    expect(result).toEqual({
      "array-tests": {
        colors: ["pink", "purple"],
      },
    });
  });
});

describe("__patch arguments", () => {
  beforeEach(() => {
    resetConfig();
    initConfig(cfg);
  });

  it("patch replaces an existing atomic field", () => {
    const result = render(["config/.a/feature"], {
      __patch: [["config/from", "patched"]],
    });

    expect(result).toEqual({
      config: {
        from: "patched",
      },
    });
  });

  it("patch throws if the target path does not exist", () => {
    expect(() =>
      render(["version/old"], {
        __patch: [["config/flags/debug", false]],
      })
    ).toThrow();
  });

  it("patches apply in order: last write wins (when field continues to exist)", () => {
    const result = render(["config/.a/feature"], {
      __patch: [
        ["config/from", "first"],
        ["config/from", "second"],
      ],
    });

    expect(result).toEqual({
      config: {
        from: "second",
      },
    });
  });

  it("patch can set a field to undefined, which removes it from the final JSON", () => {
    const result = render(["version/old"], {
      __patch: [["version", undefined]],
    });

    // version key removed
    expect(JSON.parse(JSON.stringify(result))).toEqual({}); // Removed in JSON
    expect("version" in result).toBe(true); // Still present in JS object (as undefined)
  });

  it("patching a field that exists as undefined is valid", () => {
    expect(() =>
      render(["version/old"], {
        __patch: [
          ["version", undefined],
          ["version", "0.0.2"], 
        ],
      })
    ).toEqual({
      version: "0.0.2"
    })
  });
});