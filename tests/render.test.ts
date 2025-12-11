// tests/render.test.ts
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "../src";
import { Config } from "../src/types";
import { initConfig, resetConfig } from "../src/config";

const cfg: Config = {
  templateDir: path.join(__dirname, "test-templates"),
  groupDirPrefix: ".",
  LITERAL_EXT: ".json",
  TEMPLATE_EXT: ".js",
  HIDDEN_DIR_PREFIX: "."
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
          layout: "compact"
        }
      }
    });
  });

  it("applies top-level template 'site' and resolves nested apply chain", () => {
    const result = render(["site"], {
      title: "My Site",
      heroTitle: "Custom Hero"
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
          darkColor: "darkred"
        },

        hero: {
          // from heroTheme.js (args.heroTitle)
          title: "Custom Hero",

          theme: {
            // from nested apply("colors::main") at ["theme","color"]
            // with ctx.path = ["site","hero"]
            // => /site/hero/theme/color/.colors/main.json
            color: "gold"
          }
        }
      }
    });
  });

  it("merges multiple templates into the same anchor", () => {
    const result = render(["site", "site/style/layout"], {
      title: "Combined Site"
    });

    expect(result).toEqual({
      site: {
        title: "Combined Site",
        style: {
          color: "red",
          darkColor: "darkred",
          layout: "compact"
        },
        hero: {
          title: "Hero From Template",
          theme: {
            color: "gold"
          }
        }
      }
    });
  });

  it("passes parameters into a simple template without apply (site/params)", () => {
    const result = render(["site/params"], {
      env: "prod",
      debug: true
    });

    expect(result).toEqual({
      site: {
        flags: {
          env: "prod",
          debug: true
        }
      }
    });
  });

  it("passes parameters into nested templates resolved via apply", () => {
    const result = render(["site"], {
      title: "Param Site",
      heroTitle: "Hero With Args"
    });

    expect((result.site as any)?.hero?.title).toBe("Hero With Args");
  });

  // --- shorthand & ambiguity / invalid IDs ---

  it("resolves shorthand to a single-group template (config/settings -> .only/settings.json)", () => {
    const result = render(["config/settings"], {});

    expect(result).toEqual({
      config: {
        mode: "only",
        enabled: true
      }
    });
  });

  it("throws for an ambiguous shorthand when multiple group dirs contain the same tag", () => {
    // config/.a/feature.json and config/.b/feature.json both present
    expect(() => render(["config/feature"], {})).toThrow(/ambigious-template-name|template-not-found|multiple matches/i);
  });

  it("throws for invalid template IDs with explicit file extensions", () => {
    // tagName ending with .json or .js should trigger no-explicit-file-types
    expect(() => render(["site/style/layout.json"], {})).toThrow(/no-explicit-file-types/i);
    expect(() => render(["site.js"], {})).toThrow(/no-explicit-file-types/i);
  });

  it("throws for an empty template ID", () => {
    // depends on how splitPath("") behaves; if it yields [], we hit INVALID_TEMPLATE_ID
    expect(() => render([""], {})).toThrow(/invalid-template-id/i);
  });
});