"use strict";
// src/types/index.ts
//
// Domain-level types for the template system.
// All “path meaning” primitives (ObjPath, SlotPath, FsRelPath, etc.) live in ./brands.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTemplateLiteral = exports.isTemplateFunction = void 0;
/* =========================
 * Type guards
 * ========================= */
const isTemplateFunction = (fn) => typeof fn === "function";
exports.isTemplateFunction = isTemplateFunction;
const isTemplateLiteral = (v) => !(0, exports.isTemplateFunction)(v);
exports.isTemplateLiteral = isTemplateLiteral;
