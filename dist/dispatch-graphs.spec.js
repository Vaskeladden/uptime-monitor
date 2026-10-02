"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const dispatch_graphs_1 = require("./dispatch-graphs");
jest.mock("child_process", () => ({ execFileSync: jest.fn() }));
jest.mock("@actions/core", () => ({ setSecret: jest.fn() }));
jest.mock("./helpers/dispatch-sdk-pin", () => {
    const crypto = require("crypto");
    const fixture = "module.exports = {saveRuntimeContext: async () => {}};";
    return {
        SDK_REVISION: "a".repeat(40),
        SDK_FILES: { "dispatch.cjs": crypto.createHash("sha256").update(fixture).digest("hex") },
    };
});
const fixture = "module.exports = {saveRuntimeContext: async () => {}};";
const originalEnvironment = process.env;
const originalFetch = global.fetch;
describe("tracked graph dispatcher", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnvironment,
            // Model a supported Setup event, independent of the test runner's PR event.
            GITHUB_EVENT_NAME: "repository_dispatch",
            GITHUB_REPOSITORY: "Vaskeladden/status",
            GITHUB_SHA: "b".repeat(40),
            GITHUB_REF_NAME: "main",
            GITHUB_HEAD_REF: "",
            GH_PAT: "private-pat",
            ACTIONS_RUNTIME_TOKEN: "runtime-token",
            ACTIONS_RESULTS_URL: "https://results.example.test",
            DISPATCH_JOB_CONTEXT: JSON.stringify({ check_run_id: 42, workflow_ref: "workflow", workflow_sha: "b".repeat(40) }),
        };
        child_process_1.execFileSync.mockReset().mockReturnValue(Buffer.alloc(0));
        global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from(fixture) });
    });
    afterEach(() => {
        process.env = originalEnvironment;
        global.fetch = originalFetch;
    });
    it("registers before dispatch, selects the current ref, confines credentials and removes the private package", async () => {
        process.env.GITHUB_REF_NAME = "custom-status-branch";
        await (0, dispatch_graphs_1.dispatchGraphs)("private-pat");
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`dispatch.cjs?ref=${"a".repeat(40)}`), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer private-pat" }), redirect: "error" }));
        const calls = child_process_1.execFileSync.mock.calls;
        expect(calls).toHaveLength(4);
        expect(calls[0][1]).toEqual(["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"]);
        expect(calls[1][1][0]).toBe("-e");
        expect(calls[2][1][1]).toBe("--register-sender");
        expect(calls[3][1].slice(1)).toEqual(["graphs.yml", "--repo", "Vaskeladden/status", "--ref", "custom-status-branch"]);
        for (const call of [calls[0], calls[2]]) {
            for (const key of ["GH_PAT", "GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_RESULTS_URL"]) {
                expect(call[2].env[key]).toBeUndefined();
            }
        }
        expect(calls[3][2].env.GH_TOKEN).toBe("private-pat");
        expect(calls[1][2].env.GH_PAT).toBeUndefined();
        expect(calls[1][2].env.GH_TOKEN).toBeUndefined();
        expect(calls[1][2].env.ACTIONS_RUNTIME_TOKEN).toBe("runtime-token");
        expect((0, fs_1.existsSync)(calls[0][2].cwd)).toBe(false);
    });
    it.each(["source denied", "digest mismatch", "runtime missing", "pull_request", "pull_request_target"])("never launches on %s", async (cause) => {
        if (cause === "source denied")
            global.fetch.mockResolvedValue({ ok: false });
        if (cause === "digest mismatch")
            global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from("tampered") });
        if (cause === "runtime missing")
            delete process.env.ACTIONS_RUNTIME_TOKEN;
        if (cause.startsWith("pull_request"))
            process.env.GITHUB_EVENT_NAME = cause;
        await expect((0, dispatch_graphs_1.dispatchGraphs)("private-pat")).rejects.toThrow("Tracked graph dispatch failed");
        expect(child_process_1.execFileSync).not.toHaveBeenCalled();
    });
    it.each([0, 1, 2, 3])("propagates failure at child stage %s without retry or leaking exception details", async (failedStage) => {
        const runner = child_process_1.execFileSync;
        runner.mockImplementation(() => {
            if (runner.mock.calls.length === failedStage + 1)
                throw new Error("provider response includes private-pat");
            return Buffer.alloc(0);
        });
        await expect((0, dispatch_graphs_1.dispatchGraphs)("private-pat")).rejects.toThrow(/^Tracked graph dispatch failed; inspect its sender receipts$/);
        expect(runner).toHaveBeenCalledTimes(failedStage + 1);
        expect((0, fs_1.existsSync)(runner.mock.calls[0][2].cwd)).toBe(false);
    });
});
//# sourceMappingURL=dispatch-graphs.spec.js.map