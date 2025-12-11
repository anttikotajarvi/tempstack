// groupAgnosticFind.test.ts
import path from "node:path";
import { describe, it, expect } from "vitest";

// adjust this import to where your helper actually lives
import { groupAgnosticFindWithFs } from "../src/filesystem";
import { Config } from "../src/types";


type FsNode = {
  [name: string]: FsNode | "FILE";
};

// Minimal “Dirent-like” object with just what _groupAgnosticFind uses
class MockDirent {
  name: string;
  private kind: "file" | "dir";

  constructor(name: string, kind: "file" | "dir") {
    this.name = name;
    this.kind = kind;
  }

  isFile() {
    return this.kind === "file";
  }

  isDirectory() {
    return this.kind === "dir";
  }
}

// Build a fake fs with existsSync + readdirSync({ withFileTypes: true })
function createMockFs(tree: FsNode) {
  const root: FsNode = tree;

  const toSegments = (fullPath: string): string[] => {
    const norm = path.normalize(fullPath);

    // IMPORTANT: treat "." and "" as root (no segments)
    if (norm === "." || norm === "") {
      return [];
    }

    return norm.split(path.sep).filter(Boolean);
  };

  const existsSync = (fullPath: string): boolean => {
    const segments = toSegments(fullPath);
    let node: FsNode | "FILE" = root;
    for (const seg of segments) {
      if (node === "FILE") return false;
      const next: FsNode | "FILE" | undefined = (node as FsNode)[seg];
      if (!next) return false;
      node = next;
    }
    return true;
  };

  const readdirSync = (
    fullPath: string,
    _opts: { withFileTypes: true }
  ): any[] => {
    const segments = toSegments(fullPath);
    let node: FsNode | "FILE" = root;
    for (const seg of segments) {
      if (node === "FILE") throw new Error(`Not a directory: ${fullPath}`);
      const next: FsNode | "FILE" | undefined = (node as FsNode)[seg];
      if (!next) throw new Error(`No such directory: ${fullPath}`);
      node = next;
    }
    if (node === "FILE") throw new Error(`Not a directory: ${fullPath}`);

    const entries: MockDirent[] = [];
    for (const [name, child] of Object.entries(node)) {
      entries.push(new MockDirent(name, child === "FILE" ? "file" : "dir"));
    }
    return entries;
  };

  return { existsSync, readdirSync };
}

// Minimal cfg for tests
const cfg = {
  templateDir: "",      // fake FS root is the template root
  groupDirPrefix: "."   // group dirs start with "."
};

describe("groupAgnosticFindWithFs", () => {
  it("finds a simple template with no groups", () => {
    const fs = createMockFs({
      render: {
        look: {
          "default.json": "FILE"
        }
      }
    });

    const find = groupAgnosticFindWithFs(fs as any);
    const hits = find(["render", "look"], "default", cfg as Config);

    expect(hits).toEqual([["render", "look", "default.json"]]);
  });

  it("finds templates in group dirs when anchor dir does not exist directly", () => {
    const fs = createMockFs({
      render: {
        ".a": {
          look: {
            "default.json": "FILE"
          }
        }
      }
    });

    const find = groupAgnosticFindWithFs(fs as any);
    const hits = find(["render", "look"], "default", cfg as Config);

    expect(hits).toEqual([["render", ".a", "look", "default.json"]]);
  });

  it("finds both plain and grouped variants under the same anchor", () => {
    const fs = createMockFs({
      render: {
        look: {
          "default.json": "FILE",
          ".demo": {
            "default.json": "FILE"
          }
        },
        ".a": {
          look: {
            "default.json": "FILE"
          }
        }
      }
    });

    const find = groupAgnosticFindWithFs(fs as any);
    const hits = find(["render", "look"], "default", cfg as Config);

    expect(hits.sort()).toEqual(
      [
        ["render", "look", "default.json"],
        ["render", "look", ".demo", "default.json"],
        ["render", ".a", "look", "default.json"]
      ].sort()
    );
  });

  it("recurses into nested group dirs at and below the anchor", () => {
    const fs = createMockFs({
      render: {
        ".a": {
          look: {
            ".demo": {
              "default.json": "FILE"
            }
          }
        },
        look: {
          ".demo": {
            ".extra": {
              "default.json": "FILE"
            }
          }
        }
      }
    });

    const find = groupAgnosticFindWithFs(fs as any);
    const hits = find(["render", "look"], "default", cfg as Config);

    expect(hits.sort()).toEqual(
      [
        ["render", ".a", "look", ".demo", "default.json"],
        ["render", "look", ".demo", ".extra", "default.json"]
      ].sort()
    );
  });

  it("returns an empty array when nothing matches", () => {
    const fs = createMockFs({
      render: {
        look: {
          "other.json": "FILE"
        }
      }
    });

    const find = groupAgnosticFindWithFs(fs as any);
    const hits = find(["render", "look"], "default", cfg as Config);

    expect(hits).toEqual([]);
  });

  it("handles deeper anchors with groups at multiple levels", () => {
    const fs = createMockFs({
      render: {
        ".a": {
          look: {
            ".b": {
              colorManagement: {
                "default.json": "FILE"
              }
            }
          }
        },
        look: {
          colorManagement: {
            ".demo": {
              "default.json": "FILE"
            }
          }
        }
      }
    });

    const find = groupAgnosticFindWithFs(fs as any);
    const hits = find(
      ["render", "look", "colorManagement"],
      "default",
      cfg as Config
    );

    expect(hits.sort()).toEqual(
      [
        ["render", ".a", "look", ".b", "colorManagement", "default.json"],
        ["render", "look", "colorManagement", ".demo", "default.json"]
      ].sort()
    );
  });
});
