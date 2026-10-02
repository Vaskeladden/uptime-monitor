"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const js_yaml_1 = __importDefault(require("js-yaml"));
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
const ref = "0123456789abcdef0123456789abcdef01234567";
describe("owned Status workflow generation", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.UPTIME_MONITOR_REF = ref;
    });
    afterEach(() => { delete process.env.UPTIME_MONITOR_REF; });
    it("keeps tracked dispatch failure connected to both direct graph fallback steps", async () => {
        const { setupCiWorkflow } = await Promise.resolve().then(() => __importStar(require("./workflows")));
        const workflow = js_yaml_1.default.load(await setupCiWorkflow());
        const steps = workflow.jobs.release.steps;
        const dispatch = steps.find((step) => step.id === "dispatch_graphs");
        expect(dispatch).toMatchObject({
            uses: `Vaskeladden/uptime-monitor@${ref}`,
            "continue-on-error": true,
            with: { command: "dispatch-graphs" },
            env: {
                GH_PAT: "${{ steps.app_token.outputs.token || secrets.GH_PAT || github.token }}",
                DISPATCH_JOB_CONTEXT: "${{ toJSON(job) }}",
            },
        });
        const fallback = steps.filter((step) => step.if === "steps.dispatch_graphs.outcome == 'failure'");
        expect(fallback).toHaveLength(2);
        expect(fallback[0]).toMatchObject({ uses: "actions/setup-node@v6", with: { "node-version": "20" } });
        expect(fallback[1]).toMatchObject({ uses: `Vaskeladden/uptime-monitor@${ref}`, with: { command: "graphs" } });
        expect(workflow.concurrency).toMatchObject({ "cancel-in-progress": false, queue: "max" });
    });
    it("regenerates all workflows deterministically on the same immutable owned source", async () => {
        const helpers = await Promise.resolve().then(() => __importStar(require("./workflows")));
        const generators = [helpers.graphsCiWorkflow, helpers.responseTimeCiWorkflow, helpers.setupCiWorkflow,
            helpers.siteCiWorkflow, helpers.summaryCiWorkflow, helpers.updateTemplateCiWorkflow,
            helpers.updatesCiWorkflow, helpers.uptimeCiWorkflow];
        for (const generate of generators) {
            const text = await generate();
            expect(await generate()).toBe(text);
            expect(text).not.toContain("benc-uk/workflow-dispatch");
            expect(text).not.toContain("uses: upptime/uptime-monitor@");
            expect(text).not.toContain("uptime-monitor@master");
            const workflow = js_yaml_1.default.load(text);
            expect(workflow.jobs.release.env.UPTIME_MONITOR_REF).toBe(ref);
        }
    });
    it.each([undefined, "master", "v1.44.1", "0123456"])("rejects an unpinned generator ref: %s", async (value) => {
        if (value === undefined)
            delete process.env.UPTIME_MONITOR_REF;
        else
            process.env.UPTIME_MONITOR_REF = value;
        const { setupCiWorkflow } = await Promise.resolve().then(() => __importStar(require("./workflows")));
        await expect(setupCiWorkflow()).rejects.toThrow("immutable");
    });
});
//# sourceMappingURL=tracked-workflows.spec.js.map