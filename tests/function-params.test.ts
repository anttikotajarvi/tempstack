// tests/getFunctionParams.test.ts
// @ts-nocheck
import { describe, it, expect } from "vitest";
import type * as ESTree from "estree";
import {
  getFunctionParams,
  ParamPattern,
} from "../src/parsing/function-params";

function isIdentifier(
  node: ParamPattern,
  name?: string
): node is ESTree.Identifier {
  return (
    node.type === "Identifier" && (name === undefined || node.name === name)
  );
}

function isObjectPattern(node: ParamPattern): node is ESTree.ObjectPattern {
  return node.type === "ObjectPattern";
}

function isArrayPattern(node: ParamPattern): node is ESTree.ArrayPattern {
  return node.type === "ArrayPattern";
}

function isAssignmentPattern(
  node: ParamPattern
): node is ESTree.AssignmentPattern {
  return node.type === "AssignmentPattern";
}

function isRestElement(node: ParamPattern): node is ESTree.RestElement {
  return node.type === "RestElement";
}

describe("getFunctionParams", () => {
  it("handles simple positional parameters", () => {
    const fn = function (gamma, width, height) {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(3);
    expect(isIdentifier(params[0], "gamma")).toBe(true);
    expect(isIdentifier(params[1], "width")).toBe(true);
    expect(isIdentifier(params[2], "height")).toBe(true);
  });

  it("handles arrow functions", () => {
    const fn = (gamma, width, height) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(3);
    expect(isIdentifier(params[0], "gamma")).toBe(true);
    expect(isIdentifier(params[1], "width")).toBe(true);
    expect(isIdentifier(params[2], "height")).toBe(true);
  });

  it("handles default parameters (AssignmentPattern)", () => {
    const fn = (gamma = 1.0, width = 1920, height = 1080) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(3);
    expect(isAssignmentPattern(params[0])).toBe(true);
    const p0 = params[0] as ESTree.AssignmentPattern;
    expect(isIdentifier(p0.left, "gamma")).toBe(true);

    expect(isAssignmentPattern(params[1])).toBe(true);
    const p1 = params[1] as ESTree.AssignmentPattern;
    expect(isIdentifier(p1.left, "width")).toBe(true);

    expect(isAssignmentPattern(params[2])).toBe(true);
    const p2 = params[2] as ESTree.AssignmentPattern;
    expect(isIdentifier(p2.left, "height")).toBe(true);
  });

  it("handles rest parameters", () => {
    const fn = (first, ...rest) => {};
    /**
     * Vite runtime seems to convert this to:
     * (first, ...rest2) => {}
     * So we test with raw source instead.
     */
    const source = `(first, ...rest) => {}`;
    const params = getFunctionParams(source);

    expect(params).toHaveLength(2);
    expect(isIdentifier(params[0], "first")).toBe(true);
    expect(isRestElement(params[1])).toBe(true);

    const rest = params[1] as ESTree.RestElement;
    expect(rest.argument.type).toBe("Identifier");
    expect((rest.argument as ESTree.Identifier).name).toBe("rest");
  });

  it("handles simple object destructuring", () => {
    const fn = ({ gamma, width, height }) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(1);
    expect(isObjectPattern(params[0])).toBe(true);

    const obj = params[0] as ESTree.ObjectPattern;
    const propNames = obj.properties.map((p) => {
      const prop = p as ESTree.Property;
      const key = prop.key as ESTree.Identifier;
      return key.name;
    });

    expect(propNames.sort()).toEqual(["gamma", "height", "width"].sort());
  });

  it("handles object destructuring with defaults", () => {
    const fn = ({ gamma = 1.0, width = 1920, height = 1080 }) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(1);
    expect(isObjectPattern(params[0])).toBe(true);

    const obj = params[0] as ESTree.ObjectPattern;
    const firstProp = obj.properties[0] as ESTree.Property;
    const value = firstProp.value;

    expect(value.type).toBe("AssignmentPattern");
    const assign = value as ESTree.AssignmentPattern;
    expect(assign.left.type).toBe("Identifier");
    expect((assign.left as ESTree.Identifier).name).toBe("gamma");
  });

  it("handles nested object destructuring", () => {
    const fn = ({
      look: {
        colorManagement: { gamma, exposure },
      },
    }) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(1);
    expect(isObjectPattern(params[0])).toBe(true);

    const obj = params[0] as ESTree.ObjectPattern;
    const lookProp = obj.properties[0] as ESTree.Property;
    const lookPattern = lookProp.value as ESTree.ObjectPattern;

    expect(isObjectPattern(lookPattern)).toBe(true);

    const cmProp = lookPattern.properties[0] as ESTree.Property;
    const cmPattern = cmProp.value as ESTree.ObjectPattern;

    const cmNames = cmPattern.properties.map((p) => {
      const prop = p as ESTree.Property;
      return (prop.key as ESTree.Identifier).name;
    });

    expect(cmNames.sort()).toEqual(["gamma", "exposure"].sort());
  });

  it("handles array destructuring", () => {
    const fn = ([first, second, third]) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(1);
    expect(isArrayPattern(params[0])).toBe(true);

    const arr = params[0] as ESTree.ArrayPattern;
    expect(arr.elements).toHaveLength(3);

    const names = arr.elements.map((e) =>
      e && e.type === "Identifier" ? (e as ESTree.Identifier).name : null
    );

    expect(names).toEqual(["first", "second", "third"]);
  });

  it("handles nested array/object destructuring (MDN-style)", () => {
    const fn = ([
      a,
      {
        b,
        c: [d, e],
      },
    ]) => {};
    const params = getFunctionParams(fn);

    expect(params).toHaveLength(1);
    expect(isArrayPattern(params[0])).toBe(true);

    const arr = params[0] as ESTree.ArrayPattern;
    const first = arr.elements[0]!;
    const second = arr.elements[1]!;

    expect(isIdentifier(first, "a")).toBe(true);
    expect(second.type).toBe("ObjectPattern");

    const obj = second as ESTree.ObjectPattern;
    expect(obj.properties).toHaveLength(2);

    const propB = obj.properties[0] as ESTree.Property;
    expect((propB.key as ESTree.Identifier).name).toBe("b");

    const propC = obj.properties[1] as ESTree.Property;
    const cValue = propC.value;
    expect(cValue.type).toBe("ArrayPattern");

    const cArr = cValue as ESTree.ArrayPattern;
    const [dNode, eNode] = cArr.elements as (ESTree.Pattern | null)[];
    expect(isIdentifier(dNode!, "d")).toBe(true);
    expect(isIdentifier(eNode!, "e")).toBe(true);
  });

  it("handles function declarations", () => {
    const source = `
      function colorConfig({ gamma, width }, quality = "high") {
        return {};
      }
    `;
    const params = getFunctionParams(source);

    expect(params).toHaveLength(2);
    expect(isObjectPattern(params[0])).toBe(true);
    expect(isAssignmentPattern(params[1])).toBe(true);
  });

  it("throws when no function is found", () => {
    const source = `const x = 42;`;
    expect(() => getFunctionParams(source)).toThrow(/No function node found/);
  });
});
