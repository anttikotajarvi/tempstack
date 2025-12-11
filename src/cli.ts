#!/usr/bin/env node
import { getConfig, initConfig } from "./config";
import { Config } from "./types";
import { buildTemplateTree } from "./parsing/report";
import { render } from ".";

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (const arg of rest) {
    if (arg.startsWith("--")) {
      const [k, v] = arg.slice(2).split("=");
      flags[k] = v === undefined ? true : v;
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

async function main() {
  const [, , ...argv] = process.argv;
  const { command, flags, positional } = parseArgs(argv);

  const overrides: Partial<Config> = {};
  if (typeof flags["templateDir"] === "string") {
    overrides.templateDir = flags["templateDir"] as string;
  }

  // This sets the global config (for this process) once.
  initConfig(overrides);

  if (command === "render") {
    const templateIds = positional;
    const argsJson = (flags["args"] as string) || "{}";
    const args = JSON.parse(argsJson);

    const result = render(templateIds, args);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "report") {
    const report = buildTemplateTree(getConfig());
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.error(
    `Usage:
  tempstack render [--templateDir=dir] [--args='{"foo":1}'] <templateIds...>
  tempstack report [--templateDir=dir]`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
