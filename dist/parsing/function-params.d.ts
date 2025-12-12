import type * as ESTree from "estree";
export type ParamPattern = ESTree.Pattern;
export type FuncNode = ESTree.FunctionExpression | ESTree.ArrowFunctionExpression | ESTree.FunctionDeclaration;
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
export declare function getFunctionParams(fnOrSource: Function | string): ParamPattern[];
