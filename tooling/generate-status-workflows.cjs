"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const [configuration, output, revision] = process.argv.slice(2);
  if (!configuration || !output || !/^[a-f0-9]{40}$/.test(revision || "")) {
    throw new Error("Usage: generate-status-workflows.cjs CONFIGURATION OUTPUT IMMUTABLE_ACTION_SHA");
  }
  const configPath = path.resolve(configuration);
  if (path.basename(configPath) !== ".upptimerc.yml") {
    throw new Error("Configuration must be named .upptimerc.yml");
  }
  const destination = path.resolve(output);
  process.env.UPTIME_MONITOR_REF = revision;
  process.chdir(path.dirname(configPath));
  const helpers = require("../dist/helpers/workflows.js");
  const workflows = {
    "graphs.yml": helpers.graphsCiWorkflow,
    "response-time.yml": helpers.responseTimeCiWorkflow,
    "setup.yml": helpers.setupCiWorkflow,
    "site.yml": helpers.siteCiWorkflow,
    "summary.yml": helpers.summaryCiWorkflow,
    "update-template.yml": helpers.updateTemplateCiWorkflow,
    "updates.yml": helpers.updatesCiWorkflow,
    "uptime.yml": helpers.uptimeCiWorkflow,
  };
  await fs.mkdir(destination, { recursive: true });
  for (const [name, generate] of Object.entries(workflows)) {
    await fs.writeFile(path.join(destination, name), await generate());
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
