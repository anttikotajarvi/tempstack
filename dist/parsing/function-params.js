"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFunctionParams = getFunctionParams;
const acorn = __importStar(require("acorn"));
function extractParamsFromProgram(ast) {
    var _a, _b, _c;
    for (const stmt of ast.body) {
        // function declaration at top level
        if (stmt.type === "FunctionDeclaration") {
            return ((_a = stmt.params) !== null && _a !== void 0 ? _a : []);
        }
        // const foo = function () {} / const foo = () => {}
        if (stmt.type === "VariableDeclaration") {
            for (const decl of stmt.declarations) {
                const init = decl.init;
                if (init &&
                    (init.type === "FunctionExpression" ||
                        init.type === "ArrowFunctionExpression")) {
                    return ((_b = init.params) !== null && _b !== void 0 ? _b : []);
                }
            }
        }
        // bare expression: () => {} or function() {} at top level
        if (stmt.type === "ExpressionStatement") {
            const expr = stmt.expression;
            if (expr.type === "FunctionExpression" ||
                expr.type === "ArrowFunctionExpression") {
                return ((_c = expr.params) !== null && _c !== void 0 ? _c : []);
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
function getFunctionParams(fnOrSource) {
    var _a;
    // Case 1: real Function → use toString(), parse as an expression
    if (typeof fnOrSource === "function") {
        const raw = fnOrSource.toString().trim();
        const wrapped = `(${raw});`; // expression statement
        const ast = acorn.parse(wrapped, {
            ecmaVersion: "latest",
            sourceType: "script"
        });
        const stmt = ast.body[0];
        if (stmt && stmt.type === "ExpressionStatement") {
            const expr = stmt.expression;
            if (expr.type === "FunctionExpression" ||
                expr.type === "ArrowFunctionExpression") {
                return ((_a = expr.params) !== null && _a !== void 0 ? _a : []);
            }
        }
        throw new Error("No function node found in provided source");
    }
    // Case 2: string source → parse as a full program and search for a function
    const source = String(fnOrSource).trim();
    const ast = acorn.parse(source, {
        ecmaVersion: "latest",
        sourceType: "script"
    });
    const params = extractParamsFromProgram(ast);
    if (!params) {
        throw new Error("No function node found in provided source");
    }
    return params;
}
