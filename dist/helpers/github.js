import { Octokit } from "@octokit/rest";
import { getConfig } from "./config";
import { getSecret } from "./secrets";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getGitHubErrorStatus = (error) => {
    if (typeof error !== "object" || error === null)
        return undefined;
    const status = error.status;
    if (typeof status === "number")
        return status;
    const responseStatus = error.response?.status;
    return typeof responseStatus === "number" ? responseStatus : undefined;
};
export const retryTransientGitHubRequest = async (request, options = {}) => {
    const maxAttempts = options.maxAttempts ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 1000;
    const waitForRetry = options.wait ?? wait;
    const log = options.log ?? console.warn;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await request();
        }
        catch (error) {
            const status = getGitHubErrorStatus(error);
            const isTransient = status !== undefined && status >= 500 && status <= 599;
            if (!isTransient || attempt === maxAttempts)
                throw error;
            const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
            log(`GitHub API request failed with HTTP ${status}; retrying in ${delayMs}ms`);
            await waitForRetry(delayMs);
        }
    }
    throw new Error("GitHub API retry attempts exhausted");
};
export const getOctokit = async () => {
    const config = await getConfig();
    return new Octokit({
        auth: config.PAT || getSecret("GH_PAT") || getSecret("GITHUB_TOKEN"),
        userAgent: config["user-agent"] || getSecret("USER_AGENT") || "upptime",
    });
};
//# sourceMappingURL=github.js.map