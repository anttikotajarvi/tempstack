import { describe, it, expect } from "vitest";
import { getUsedArguments } from "../src/parsing/report";

describe("getUsedArguments()", () => {
    it("extracts used argument names from a template function", () => {
        const tFn = require("../tests/test-templates/site.js");

        const usedArgs = getUsedArguments(tFn);
        expect(usedArgs).toEqual(["title", "heroTitle"]);
    });
});
