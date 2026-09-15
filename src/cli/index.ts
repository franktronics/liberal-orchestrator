import { defineCommand, runMain } from "citty";
import pkg from "../../package.json";
import { modelsCommand } from "./commands/models";

const main = defineCommand({
  meta: {
    name: "lior",
    description:
      "Explicitly configure which AI models play which roles in agent coding harnesses (Codex, OpenCode)",
    version: pkg.version,
  },
  subCommands: {
    models: modelsCommand,
  },
});

runMain(main);
