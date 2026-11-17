import dayjs from "dayjs";
import { getConfig } from "./config";
import { getOctokit } from "./github";
import { getOwnerRepo } from "./secrets";
/** Calculate the average of some numbers */
const avg = (array) => (array.length ? array.reduce((a, b) => a + b) / array.length : 0);
/** Get commits for a history file */
const getHistoryItems = async (octokit, owner, repo, slug, page) => {
    console.log("Fetching history - page", 1);
    const results = await octokit.repos.listCommits({
        owner,
        repo,
        path: `history/${slug}.yml`,
        per_page: 100,
        page,
    });
    let data = results.data;
    if (!data[0])
        return [];
    if (data.length === 100 &&
        !dayjs((data[0].commit.author || {}).date).isBefore(dayjs().subtract(1, "year")))
        data.push(...(await getHistoryItems(octokit, owner, repo, slug, page + 1)));
    return data;
};
export const getResponseTimeForSite = async (slug) => {
    const [owner, repo] = getOwnerRepo();
    const octokit = await getOctokit();
    const config = await getConfig();
    const data = await getHistoryItems(octokit, owner, repo, slug, 1);
    const responseTimes = data
        .filter((item) => item.commit.message.includes(" in ") &&
        Number(item.commit.message.split(" in ")[1].split("ms")[0].trim()) !== 0 &&
        !isNaN(Number(item.commit.message.split(" in ")[1].split("ms")[0].trim())))
        /**
         * Parse the commit message
         * @example "🟥 Broken Site is down (500 in 321 ms) [skip ci] [upptime]"
         * @returns [Date, 321] where Date is the commit date
         */
        .map((item) => [
        (item.commit.author || {}).date,
        parseInt(item.commit.message.split(" in ")[1].split("ms")[0].trim()),
    ])
        .filter((item) => item[1] && !isNaN(item[1]));
    const daySum = responseTimes
        .filter((i) => dayjs(i[0]).isAfter(dayjs().subtract(1, "day")))
        .map((i) => i[1]);
    const weekSum = responseTimes
        .filter((i) => dayjs(i[0]).isAfter(dayjs().subtract(1, "week")))
        .map((i) => i[1]);
    const monthSum = responseTimes
        .filter((i) => dayjs(i[0]).isAfter(dayjs().subtract(1, "month")))
        .map((i) => i[1]);
    const yearSum = responseTimes
        .filter((i) => dayjs(i[0]).isAfter(dayjs().subtract(1, "year")))
        .map((i) => i[1]);
    const allSum = responseTimes.map((i) => i[1]);
    console.log("weekSum", weekSum, avg(weekSum));
    // Current status is "up", "down", or "degraded" based on the emoji prefix of the commit message
    const currentStatus = data[0]
        ? data[0].commit.message.split(" ")[0].includes(config.commitPrefixStatusUp || "🟩")
            ? "up"
            : data[0].commit.message.split(" ")[0].includes(config.commitPrefixStatusDegraded || "🟨")
                ? "degraded"
                : "down"
        : "up";
    return {
        day: Math.round(avg(daySum) || 0),
        week: Math.round(avg(weekSum) || 0),
        month: Math.round(avg(monthSum) || 0),
        year: Math.round(avg(yearSum) || 0),
        all: Math.round(avg(allSum) || 0),
        currentStatus,
    };
};
//# sourceMappingURL=calculate-response-time.js.map