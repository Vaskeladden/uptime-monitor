import { setSecret } from "@actions/core";
import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { delimiter, dirname, join } from "path";
import { SDK_FILES, SDK_REVISION } from "./helpers/dispatch-sdk-pin";

// Keep the private package private: fetch only these reviewed files at runtime.
// Nothing from that package is vendored into this public action or its bundle.
export const dispatchGraphs = async (token: string): Promise<void> => {
  let directory: string | undefined;
  let stage = "context";
  try {
    if (!token) throw new Error("Missing dispatch token");
    setSecret(token);
    // Generated Setup never runs on PRs. Reject that unsupported context rather
    // than recording its synthetic merge SHA as the original sender head.
    if (["pull_request", "pull_request_target"].includes(process.env.GITHUB_EVENT_NAME || "")) {
      throw new Error("Graph dispatch does not support pull request events");
    }
    for (const key of ["ACTIONS_RUNTIME_TOKEN", "ACTIONS_RESULTS_URL"]) {
      const value = process.env[key];
      if (!value) throw new Error("Missing Actions runtime context");
      setSecret(value);
    }
    const job: unknown = JSON.parse(process.env.DISPATCH_JOB_CONTEXT || "null");
    if (!job || typeof job !== "object" || Array.isArray(job)
        || !("check_run_id" in job) || !Number.isSafeInteger(job.check_run_id)
        || !("workflow_ref" in job) || typeof job.workflow_ref !== "string"
        || !("workflow_sha" in job) || typeof job.workflow_sha !== "string") {
      throw new Error("Missing native job context");
    }
    const repository = process.env.GITHUB_REPOSITORY;
    const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
    if (!repository || !ref) throw new Error("Missing receiving repository or ref");

    directory = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), "upptime-dispatch-"));
    stage = "fetch";
    for (const [file, expected] of Object.entries(SDK_FILES)) {
      const response = await fetch(
        `https://api.github.com/repos/Vaskeladden/automation-actions/contents/.github/actions/setup-github-dispatch/${file}?ref=${SDK_REVISION}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.raw+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        }
      );
      if (!response.ok) throw new Error("SDK source unavailable");
      const content = Buffer.from(await response.arrayBuffer());
      if (createHash("sha256").update(content).digest("hex") !== expected) {
        throw new Error("SDK source does not match its reviewed digest");
      }
      const destination = join(directory, file);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content, { mode: 0o600, flag: "wx" });
    }

    // Installation receives no provider token or artifact credentials.
    const childEnvironment: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key !== "GITHUB_TOKEN" && /^(GITHUB_|RUNNER_|PATH$|HOME$|TMPDIR$|TEMP$)/.test(key)) {
        childEnvironment[key] = value;
      }
    }
    childEnvironment.PATH = dirname(process.execPath) + delimiter + (process.env.PATH || "");
    const childOptions = { cwd: directory, env: childEnvironment, stdio: "inherit" as const, timeout: 180000 };
    stage = "install";
    execFileSync("npm", ["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"], childOptions);

    const entry = join(directory, "dispatch.cjs");
    stage = "load";
    // A separate Node process loads the pinned file at runtime; ncc must not
    // transform a dynamic require or load private code inside this action.
    const saveContext = "require(process.argv[1]).saveRuntimeContext(process.argv[2], process.env)"
      + ".catch(() => { console.error('Cannot save dispatch runtime context'); process.exitCode = 1; });";
    execFileSync(process.execPath, ["-e", saveContext, entry, directory], {
      ...childOptions,
      env: {
        ...childEnvironment,
        ACTIONS_RUNTIME_TOKEN: process.env.ACTIONS_RUNTIME_TOKEN,
        ACTIONS_RESULTS_URL: process.env.ACTIONS_RESULTS_URL,
        AUTOMATION_DISPATCH_HEAD_SHA: process.env.GITHUB_SHA,
        AUTOMATION_DISPATCH_CHECK_RUN_ID: String(job.check_run_id),
        AUTOMATION_DISPATCH_JOB_WORKFLOW_REF: job.workflow_ref,
        AUTOMATION_DISPATCH_JOB_WORKFLOW_SHA: job.workflow_sha,
      },
    });
    stage = "register";
    execFileSync(process.execPath, [entry, "--register-sender"], childOptions);
    stage = "dispatch";
    execFileSync(process.execPath, [entry, "graphs.yml", "--repo", repository, "--ref", ref], {
      ...childOptions,
      env: { ...childEnvironment, GH_TOKEN: token },
    });
  } catch {
    console.error(`Tracked graph dispatch stage failed: ${stage}`);
    // Provider/npm errors can contain credential-bearing response bodies.
    throw new Error("Tracked graph dispatch failed; inspect its sender receipts");
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
};
