import fs from "fs";
import path from "path";
import yaml from "js-yaml";

jest.mock("./config", () => ({
  getConfig: jest.fn().mockResolvedValue({
    sites: [],
    workflowSchedule: {},
    commitMessages: {},
    "status-website": {},
  }),
}));
jest.mock("./github", () => ({
  getOctokit: jest.fn().mockResolvedValue({
    repos: { listReleases: jest.fn().mockResolvedValue({ data: [{ tag_name: "v1.44.1" }] }) },
  }),
}));

interface WorkflowStep {
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
}
interface GeneratedWorkflow {
  env?: { AUTOMATION_CONTRACT: string };
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, { steps: WorkflowStep[]; env: Record<string, string>; permissions?: Record<string, string> }>;
  concurrency: Record<string, string | boolean>;
}

const ref = "0123456789abcdef0123456789abcdef01234567";

describe("owned Status workflow generation", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.UPTIME_MONITOR_REF = ref;
  });

  afterEach(() => { delete process.env.UPTIME_MONITOR_REF; });

  it("admits only the declared generator workflow", () => {
    const directory = path.resolve(__dirname, "../../.github/workflows");
    expect(fs.readdirSync(directory).filter(name => /\.ya?ml$/i.test(name)).sort())
      .toEqual(["generator-ci.yml"]);
    const source = fs.readFileSync(path.join(directory, "generator-ci.yml"), "utf8");
    const workflow = yaml.load(source) as GeneratedWorkflow;
    expect(workflow.on).toEqual({ pull_request: null, push: { branches: ["master"] } });
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(source).not.toMatch(/secrets\s*(?:\.|\[)/i);
    for (const job of Object.values(workflow.jobs)) {
      if (job.permissions !== undefined) expect(job.permissions).toEqual({ contents: "read" });
    }
    expect(JSON.parse(workflow.env!.AUTOMATION_CONTRACT)).toMatchObject({
      id: "gha.uptime-monitor.generator-ci", owner: "platform",
      architecture: { recipe: "github-workflow", disposition: "fits" },
      legs: [{ id: "gha-uptime-monitor-generator-ci-yml", required_proof: "run", adapter: "github-actions-run" }],
    });
  });

  it("emits the uptime declaration beside the workflow it owns", async () => {
    const { uptimeCiWorkflow } = await import("./workflows");
    const workflow = yaml.load(await uptimeCiWorkflow()) as GeneratedWorkflow;
    expect(JSON.parse(workflow.env!.AUTOMATION_CONTRACT)).toMatchObject({
      id: "gha.status.uptime-probe", owner: "platform",
      architecture: { recipe: "github-workflow", disposition: "exception" },
      legs: [{ id: "gha-status-uptime-yml", required_proof: "run", adapter: "github-actions-run" }],
    });
  });

  it("keeps tracked dispatch failure connected to both direct graph fallback steps", async () => {
    const { setupCiWorkflow } = await import("./workflows");
    const workflow = yaml.load(await setupCiWorkflow()) as GeneratedWorkflow;
    const steps = workflow.jobs.release.steps;
    const dispatch = steps.find((step: WorkflowStep) => step.id === "dispatch_graphs");
    expect(dispatch).toMatchObject({
      uses: `Vaskeladden/uptime-monitor@${ref}`,
      "continue-on-error": true,
      with: { command: "dispatch-graphs" },
      env: {
        GH_PAT: "${{ steps.app_token.outputs.token || secrets.GH_PAT || github.token }}",
        DISPATCH_JOB_CONTEXT: "${{ toJSON(job) }}",
      },
    });
    const fallback = steps.filter((step: WorkflowStep) => step.if === "steps.dispatch_graphs.outcome == 'failure'");
    expect(fallback).toHaveLength(2);
    expect(fallback[0]).toMatchObject({ uses: "actions/setup-node@v6", with: { "node-version": "20" } });
    expect(fallback[1]).toMatchObject({ uses: `Vaskeladden/uptime-monitor@${ref}`, with: { command: "graphs" } });
    expect(workflow.concurrency).toMatchObject({ "cancel-in-progress": false, queue: "max" });
  });

  it("regenerates all workflows deterministically on the same immutable owned source", async () => {
    const helpers = await import("./workflows");
    const generators = [helpers.graphsCiWorkflow, helpers.responseTimeCiWorkflow, helpers.setupCiWorkflow,
      helpers.siteCiWorkflow, helpers.summaryCiWorkflow, helpers.updateTemplateCiWorkflow,
      helpers.updatesCiWorkflow, helpers.uptimeCiWorkflow];
    for (const generate of generators) {
      const text = await generate();
      expect(await generate()).toBe(text);
      expect(text).not.toContain("benc-uk/workflow-dispatch");
      expect(text).not.toContain("uses: upptime/uptime-monitor@");
      expect(text).not.toContain("uptime-monitor@master");
      const workflow = yaml.load(text) as GeneratedWorkflow;
      expect(workflow.jobs.release.env.UPTIME_MONITOR_REF).toBe(ref);
    }
  });

  it("keeps adversarial site values out of generated workflow structure", async () => {
    const { getConfig } = await import("./config");
    const helpers = await import("./workflows");
    const generators = [helpers.graphsCiWorkflow, helpers.responseTimeCiWorkflow, helpers.setupCiWorkflow,
      helpers.siteCiWorkflow, helpers.summaryCiWorkflow, helpers.updateTemplateCiWorkflow,
      helpers.updatesCiWorkflow, helpers.uptimeCiWorkflow];
    const baseline = await Promise.all(generators.map(generate => generate()));
    (getConfig as jest.Mock).mockResolvedValue({
      sites: [{ name: 'quoted "site"\nrun: injected', url: 'https://example.com/"\n${{ secrets.INJECTED_SECRET }}' }],
      workflowSchedule: {}, commitMessages: {}, "status-website": {},
    });
    for (const [index, generate] of generators.entries()) {
      const workflow = yaml.load(await generate()) as GeneratedWorkflow;
      expect(workflow).toEqual(yaml.load(baseline[index]));
      for (const job of Object.values(workflow.jobs)) {
        for (const step of job.steps) expect(step.run || "").not.toContain("INJECTED_SECRET");
      }
    }
  });

  it.each([undefined, "master", "v1.44.1", "0123456"])("rejects an unpinned generator ref: %s", async value => {
    if (value === undefined) delete process.env.UPTIME_MONITOR_REF;
    else process.env.UPTIME_MONITOR_REF = value;
    const { setupCiWorkflow } = await import("./workflows");
    await expect(setupCiWorkflow()).rejects.toThrow("immutable");
  });
});
