"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTemplateLiteral = exports.isTemplateFunction = void 0;
const isTemplateFunction = (fn) => {
    return typeof fn === "function";
};
exports.isTemplateFunction = isTemplateFunction;
const isTemplateLiteral = (v) => {
    return !(0, exports.isTemplateFunction)(v);
};
exports.isTemplateLiteral = isTemplateLiteral;
