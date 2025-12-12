#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const report_1 = require("./parsing/report");
const _1 = require(".");
function parseArgs(argv) {
    const [command, ...rest] = argv;
    const flags = {};
    const positional = [];
    for (const arg of rest) {
        if (arg.startsWith("--")) {
            const [k, v] = arg.slice(2).split("=");
            flags[k] = v === undefined ? true : v;
        }
        else {
            positional.push(arg);
        }
    }
    return { command, flags, positional };
}
async function main() {
    const [, , ...argv] = process.argv;
    const { command, flags, positional } = parseArgs(argv);
    const overrides = {};
    if (typeof flags["templateDir"] === "string") {
        overrides.templateDir = flags["templateDir"];
    }
    // This sets the global config (for this process) once.
    (0, config_1.initConfig)(overrides);
    if (command === "render") {
        const templateIds = positional;
        const argsJson = flags["args"] || "{}";
        const args = JSON.parse(argsJson);
        const result = (0, _1.render)(templateIds, args);
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    if (command === "report") {
        const report = (0, report_1.buildTemplateTree)((0, config_1.getConfig)());
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.error(`Usage:
  tempstack render [--templateDir=dir] [--args='{"foo":1}'] <templateIds...>
  tempstack report [--templateDir=dir]`);
    process.exit(1);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
