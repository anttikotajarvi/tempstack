import * as acorn from "acorn";
import type * as ESTree from "estree";

export type ParamPattern = ESTree.Pattern;

export type FuncNode = ESTree.FunctionExpression | ESTree.ArrowFunctionExpression | ESTree.FunctionDeclaration;

function extractParamsFromProgram(ast: ESTree.Program): ParamPattern[] | null {
  for (const stmt of ast.body) {
    // function declaration at top level
    if (stmt.type === "FunctionDeclaration") {
      return (stmt.params ?? []) as ParamPattern[];
    }

    // const foo = function () {} / const foo = () => {}
    if (stmt.type === "VariableDeclaration") {
      for (const decl of stmt.declarations) {
        const init = decl.init;
        if (
          init &&
          (init.type === "FunctionExpression" ||
            init.type === "ArrowFunctionExpression")
        ) {
          return (init.params ?? []) as ParamPattern[];
        }
      }
    }

    // bare expression: () => {} or function() {} at top level
    if (stmt.type === "ExpressionStatement") {
      const expr = stmt.expression;
      if (
        expr.type === "FunctionExpression" ||
        expr.type === "ArrowFunctionExpression"
      ) {
        return (expr.params ?? []) as ParamPattern[];
      }
    }
  }

  return null;
}

/**
 * Parse the parameter patterns from a function or a function-like source string.
 * Runtime specific (parameters may be renamed, minified, etc.), so run only from vanilla JS source.
 * Supports:
 * - Functions passed directly (arrow or function expression)
 * - Source strings containing:
 *   - function declarations
 *   - variable declarations with function/arrow initializers
 *   - bare function/arrow expressions
 * - Any kind of JS destructuring (nested object/array, defaults, rest, etc.)

 */
export function getFunctionParams(fnOrSource: Function | string): ParamPattern[] {
  // Case 1: real Function → use toString(), parse as an expression
  if (typeof fnOrSource === "function") {
    const raw = fnOrSource.toString().trim();
    const wrapped = `(${raw});`; // expression statement

    const ast = acorn.parse(wrapped, {
      ecmaVersion: "latest",
      sourceType: "script"
    }) as unknown as ESTree.Program;

    const stmt = ast.body[0];
    if (stmt && stmt.type === "ExpressionStatement") {
      const expr = stmt.expression as ESTree.Expression;
      if (
        expr.type === "FunctionExpression" ||
        expr.type === "ArrowFunctionExpression"
      ) {
        return (expr.params ?? []) as ParamPattern[];
      }
    }

    throw new Error("No function node found in provided source");
  }

  // Case 2: string source → parse as a full program and search for a function
  const source = String(fnOrSource).trim();

  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "script"
  }) as unknown as ESTree.Program;

  const params = extractParamsFromProgram(ast);
  if (!params) {
    throw new Error("No function node found in provided source");
  }

  return params;
}
