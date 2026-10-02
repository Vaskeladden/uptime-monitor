"use strict";

// Exercise the shipped entry point with a public fixture, never private SDK
// source or live credentials. Only downloads, their fixture digests, and npm
// installation are substituted; the runtime Node children execute normally.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const sdkFixture = `
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.GITHUB_WORKSPACE;
const record = stage => fs.appendFileSync(path.join(directory, 'stages'), stage + '\\n');
exports.saveRuntimeContext = async (target, environment) => {
  const required = [
    'GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT',
    'GITHUB_SHA', 'GITHUB_EVENT_NAME', 'GITHUB_WORKFLOW_SHA', 'GITHUB_WORKFLOW_REF', 'GITHUB_JOB',
    'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_RESULTS_URL', 'AUTOMATION_DISPATCH_CHECK_RUN_ID',
    'AUTOMATION_DISPATCH_JOB_WORKFLOW_REF', 'AUTOMATION_DISPATCH_JOB_WORKFLOW_SHA', 'AUTOMATION_DISPATCH_HEAD_SHA',
  ];
  for (const key of required) assert.ok(typeof environment[key] === 'string' && environment[key].length > 0, key);
  assert.equal(environment.GH_PAT, undefined);
  assert.equal(environment.GH_TOKEN, undefined);
  assert.equal(environment.GITHUB_TOKEN, undefined);
  assert.equal(environment.ACTIONS_RUNTIME_TOKEN, 'fixture-runtime');
  assert.equal(environment.AUTOMATION_DISPATCH_CHECK_RUN_ID, '42');
  assert.equal(environment.AUTOMATION_DISPATCH_JOB_WORKFLOW_SHA, 'b'.repeat(40));
  fs.writeFileSync(path.join(target, 'runtime-context.json'), '{}');
  record('context');
};
if (require.main === module) {
  assert.ok(fs.existsSync(path.join(__dirname, 'runtime-context.json')));
  assert.equal(process.env.GH_PAT, undefined);
  assert.equal(process.env.GITHUB_TOKEN, undefined);
  assert.equal(process.env.ACTIONS_RUNTIME_TOKEN, undefined);
  if (process.argv[2] === '--register-sender') {
    assert.equal(process.env.GH_TOKEN, undefined);
    record('register');
  } else {
    assert.equal(process.env.GH_TOKEN, 'fixture-pat');
    assert.deepEqual(process.argv.slice(2), ['graphs.yml', '--repo', 'Vaskeladden/status', '--ref', 'fixture-branch']);
    record('dispatch');
  }
}
`;

if (process.env.UPPTIME_DISPATCH_SMOKE === "preload") {
  const { SDK_FILES, SDK_REVISION } = require("../dist/helpers/dispatch-sdk-pin.js");
  const fixtures = {
    "package.json": '{"name":"dispatch-smoke","version":"1.0.0"}',
    "package-lock.json": '{"name":"dispatch-smoke","lockfileVersion":3}',
    "dispatch.cjs": sdkFixture,
    "bin/automation-dispatch": "// public smoke fixture executable\n",
  };
  const crypto = require("node:crypto");
  const createHash = crypto.createHash;
  crypto.createHash = function (algorithm, options) {
    const hash = createHash.call(this, algorithm, options);
    let bytes = Buffer.alloc(0);
    const update = hash.update.bind(hash);
    const digest = hash.digest.bind(hash);
    hash.update = (value, encoding) => {
      bytes = Buffer.concat([bytes, Buffer.from(value, encoding)]);
      update(value, encoding);
      return hash;
    };
    hash.digest = encoding => {
      const fixture = Object.entries(fixtures).find(([, body]) => Buffer.from(body).equals(bytes));
      return fixture && algorithm === "sha256" && encoding === "hex" ? SDK_FILES[fixture[0]] : digest(encoding);
    };
    return hash;
  };
  global.fetch = async (url, options) => {
    const prefix = "https://api.github.com/repos/Vaskeladden/automation-actions/contents/.github/actions/setup-github-dispatch/";
    assert.ok(url.startsWith(prefix));
    assert.ok(url.endsWith(`?ref=${SDK_REVISION}`));
    assert.equal(options.headers.Authorization, "Bearer fixture-pat");
    assert.equal(options.redirect, "error");
    const name = url.slice(prefix.length).split("?")[0];
    assert.ok(Object.hasOwn(fixtures, name));
    return { ok: true, arrayBuffer: async () => Buffer.from(fixtures[name]) };
  };
  const execute = childProcess.execFileSync;
  childProcess.execFileSync = function (command, args, options) {
    if (command !== "npm") return execute.call(this, command, args, options);
    assert.deepEqual(args, ["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"]);
    for (const key of ["GH_PAT", "GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_RESULTS_URL"]) {
      assert.equal(options.env[key], undefined);
    }
    fs.appendFileSync(path.join(process.env.GITHUB_WORKSPACE, "stages"), "install\n");
    return Buffer.alloc(0);
  };
} else {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "packaged-dispatch-smoke-"));
  try {
    const result = childProcess.spawnSync(process.execPath, ["--require", __filename, path.join(__dirname, "../dist/index.js")], {
      encoding: "utf8",
      timeout: 60000,
      env: {
        PATH: process.env.PATH,
        RUNNER_TEMP: directory,
        GITHUB_WORKSPACE: directory,
        GITHUB_REPOSITORY: "Vaskeladden/status",
        GITHUB_ACTIONS: "true",
        GITHUB_RUN_ID: "100",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_SHA: "b".repeat(40),
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_WORKFLOW_SHA: "b".repeat(40),
        GITHUB_WORKFLOW_REF: "Vaskeladden/status/.github/workflows/setup.yml@refs/heads/fixture-branch",
        GITHUB_JOB: "release",
        GITHUB_REF_NAME: "fixture-branch",
        GH_PAT: "fixture-pat",
        GITHUB_TOKEN: "fixture-default-token",
        ACTIONS_RUNTIME_TOKEN: "fixture-runtime",
        ACTIONS_RESULTS_URL: "https://results.invalid",
        INPUT_COMMAND: "dispatch-graphs",
        UPTIME_MONITOR_REF: "a".repeat(40),
        UPPTIME_DISPATCH_SMOKE: "preload",
        DISPATCH_JOB_CONTEXT: JSON.stringify({
          check_run_id: 42,
          workflow_ref: "Vaskeladden/status/.github/workflows/setup.yml@refs/heads/fixture-branch",
          workflow_sha: "b".repeat(40),
        }),
      },
    });
    assert.equal(result.status, 0, result.error?.message || `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.readFileSync(path.join(directory, "stages"), "utf8"), "install\ncontext\nregister\ndispatch\n");
    assert.deepEqual(fs.readdirSync(directory), ["stages"]);
    console.log("Packaged dispatcher reached context save, registration and dispatch; temporary SDK removed.");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
