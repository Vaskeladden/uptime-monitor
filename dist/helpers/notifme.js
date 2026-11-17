import axios from "axios";
import NotifmeSdk from "notifme-sdk";
import { replaceEnvironmentVariables } from "./environment";
import { getSecret } from "./secrets";
const notifmeChannelLabels = {
    email: "email",
    sms: "SMS",
    slack: "Slack",
};
export const formatNotificationError = (error) => {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    if (error && typeof error === "object" && "message" in error) {
        const message = error.message;
        if (typeof message === "string")
            return message;
    }
    return String(error);
};
const logNotificationError = (channel, error) => {
    console.log(`Error sending ${channel}: ${formatNotificationError(error)}`);
};
const logNotifmeSendResult = (channel, result) => {
    const label = notifmeChannelLabels[channel];
    if (result?.status === "error") {
        logNotificationError(label, result.errors?.[channel] || result.errors || result);
        return false;
    }
    console.log(`Success ${label}`);
    return true;
};
export const formatTelegramHtmlMessage = (message) => message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([\s\S]*?)\*\*/g, "<b>$1</b>");
export const createTeamsAdaptiveCardPayload = (message) => ({
    type: "message",
    attachments: [
        {
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
                $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.2",
                body: [
                    {
                        type: "TextBlock",
                        text: message,
                        wrap: true,
                    },
                ],
            },
        },
    ],
});
const channels = {};
if (getSecret("NOTIFICATION_EMAIL_SENDGRID") ||
    getSecret("NOTIFICATION_EMAIL_SES") ||
    getSecret("NOTIFICATION_EMAIL_SPARKPOST") ||
    getSecret("NOTIFICATION_EMAIL_MAILGUN") ||
    getSecret("NOTIFICATION_EMAIL_SMTP")) {
    channels.email = {
        providers: [],
        multiProviderStrategy: getSecret("NOTIFICATION_EMAIL_STRATEGY") ||
            "roundrobin",
    };
    if (getSecret("NOTIFICATION_EMAIL_SENDGRID")) {
        channels.email.providers.push({
            type: "sendgrid",
            apiKey: getSecret("NOTIFICATION_EMAIL_SENDGRID_API_KEY"),
        });
    }
    if (getSecret("NOTIFICATION_EMAIL_SES")) {
        channels.email.providers.push({
            type: "ses",
            region: getSecret("NOTIFICATION_EMAIL_SES_REGION"),
            accessKeyId: getSecret("NOTIFICATION_EMAIL_SES_ACCESS_KEY_ID"),
            secretAccessKey: getSecret("NOTIFICATION_EMAIL_SES_SECRET_ACCESS_KEY"),
            sessionToken: getSecret("NOTIFICATION_EMAIL_SES_SESSION_TOKEN"),
        });
    }
    if (getSecret("NOTIFICATION_EMAIL_SPARKPOST")) {
        channels.email.providers.push({
            type: "sparkpost",
            apiKey: getSecret("NOTIFICATION_EMAIL_SPARKPOST_API_KEY"),
        });
    }
    if (getSecret("NOTIFICATION_EMAIL_MAILGUN")) {
        channels.email.providers.push({
            type: "mailgun",
            apiKey: getSecret("NOTIFICATION_EMAIL_MAILGUN_API_KEY"),
            domainName: getSecret("NOTIFICATION_EMAIL_MAILGUN_DOMAIN_NAME"),
        });
    }
    if (getSecret("NOTIFICATION_EMAIL_SMTP")) {
        channels.email.providers.push({
            type: "smtp",
            port: (getSecret("NOTIFICATION_EMAIL_SMTP_PORT")
                ? parseInt(getSecret("NOTIFICATION_EMAIL_SMTP_PORT") || "", 10)
                : 587),
            host: getSecret("NOTIFICATION_EMAIL_SMTP_HOST"),
            auth: {
                user: getSecret("NOTIFICATION_EMAIL_SMTP_USERNAME"),
                pass: getSecret("NOTIFICATION_EMAIL_SMTP_PASSWORD"),
            },
        });
    }
}
if (getSecret("NOTIFICATION_SMS_46ELKS") ||
    getSecret("NOTIFICATION_SMS_CALLR") ||
    getSecret("NOTIFICATION_SMS_CLICKATELL") ||
    getSecret("NOTIFICATION_SMS_INFOBIP") ||
    getSecret("NOTIFICATION_SMS_NEXMO") ||
    getSecret("NOTIFICATION_SMS_OVH") ||
    getSecret("NOTIFICATION_SMS_PLIVO") ||
    getSecret("NOTIFICATION_SMS_TWILIO")) {
    channels.sms = {
        providers: [],
        multiProviderStrategy: getSecret("NOTIFICATION_SMS_STRATEGY") ||
            "roundrobin",
    };
    if (getSecret("NOTIFICATION_SMS_46ELKS")) {
        channels.sms.providers.push({
            type: "46elks",
            apiUsername: getSecret("NOTIFICATION_SMS_46ELKS_API_USERNAME"),
            apiPassword: getSecret("NOTIFICATION_SMS_46ELKS_API_PASSWORD"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_CALLR")) {
        channels.sms.providers.push({
            type: "callr",
            login: getSecret("NOTIFICATION_SMS_CALLR_LOGIN"),
            password: getSecret("NOTIFICATION_SMS_CALLR_PASSWORD"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_CLICKATELL")) {
        channels.sms.providers.push({
            type: "clickatell",
            apiKey: getSecret("NOTIFICATION_SMS_CLICKATELL_API_KEY"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_INFOBIP")) {
        channels.sms.providers.push({
            type: "infobip",
            username: getSecret("NOTIFICATION_SMS_INFOBIP_USERNAME"),
            password: getSecret("NOTIFICATION_SMS_INFOBIP_PASSWORD"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_NEXMO")) {
        channels.sms.providers.push({
            type: "nexmo",
            apiKey: getSecret("NOTIFICATION_SMS_NEXMO_API_KEY"),
            apiSecret: getSecret("NOTIFICATION_SMS_NEXMO_API_SECRET"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_OVH")) {
        channels.sms.providers.push({
            type: "ovh",
            appKey: getSecret("NOTIFICATION_SMS_OVH_APP_KEY"),
            appSecret: getSecret("NOTIFICATION_SMS_OVH_APP_SECRET"),
            consumerKey: getSecret("NOTIFICATION_SMS_OVH_CONSUMER_KEY"),
            account: getSecret("NOTIFICATION_SMS_OVH_ACCOUNT"),
            host: getSecret("NOTIFICATION_SMS_OVH_HOST"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_PLIVO")) {
        channels.sms.providers.push({
            type: "plivo",
            authId: getSecret("NOTIFICATION_SMS_PLIVO_AUTH_ID"),
            authToken: getSecret("NOTIFICATION_SMS_PLIVO_AUTH_TOKEN"),
        });
    }
    if (getSecret("NOTIFICATION_SMS_TWILIO")) {
        channels.sms.providers.push({
            type: "twilio",
            accountSid: getSecret("NOTIFICATION_SMS_TWILIO_ACCOUNT_SID"),
            authToken: getSecret("NOTIFICATION_SMS_TWILIO_AUTH_TOKEN"),
        });
    }
}
const slackWebhookUrl = getSecret("NOTIFICATION_SLACK_WEBHOOK_URL");
if (getSecret("NOTIFICATION_SLACK") && slackWebhookUrl) {
    channels.slack = {
        providers: [
            {
                type: "webhook",
                webhookUrl: slackWebhookUrl,
            },
        ],
        multiProviderStrategy: getSecret("NOTIFICATION_SLACK_STRATEGY") ||
            "roundrobin",
    };
}
const notifier = new NotifmeSdk({
    channels,
});
export const sendNotification = async (message) => {
    console.log("Sending notification", message);
    message = replaceEnvironmentVariables(message);
    if (channels.email) {
        console.log("Sending email");
        try {
            const result = await notifier.send({
                email: {
                    from: (getSecret("NOTIFICATION_EMAIL_FROM") || getSecret("NOTIFICATION_EMAIL")),
                    to: (getSecret("NOTIFICATION_EMAIL_TO") || getSecret("NOTIFICATION_EMAIL")),
                    subject: message,
                    html: message,
                },
            });
            logNotifmeSendResult("email", result);
        }
        catch (error) {
            logNotificationError("email", error);
        }
        console.log("Finished sending email");
    }
    if (channels.sms) {
        console.log("Sending SMS");
        try {
            const phoneNumbers = getSecret("NOTIFICATION_SMS_TO")?.split(",") ?? [];
            for (const phoneNumber of phoneNumbers) {
                const result = await notifier.send({
                    sms: {
                        from: getSecret("NOTIFICATION_SMS_FROM"),
                        to: phoneNumber,
                        text: message,
                    },
                });
                if (!logNotifmeSendResult("sms", result))
                    break;
            }
        }
        catch (error) {
            logNotificationError("SMS", error);
        }
        console.log("Finished sending SMS");
    }
    if (channels.slack) {
        console.log("Sending Slack");
        try {
            const result = await notifier.send({
                slack: {
                    text: message,
                },
            });
            logNotifmeSendResult("slack", result);
        }
        catch (error) {
            logNotificationError("Slack", error);
        }
        console.log("Finished sending Slack");
    }
    if (getSecret("NOTIFICATION_DISCORD_WEBHOOK_URL")) {
        console.log("Sending Discord");
        try {
            await axios.post(getSecret("NOTIFICATION_DISCORD_WEBHOOK_URL"), {
                content: message,
            });
            console.log("Success Discord");
        }
        catch (error) {
            logNotificationError("Discord", error);
        }
        console.log("Finished sending Discord");
    }
    if (getSecret("NOTIFICATION_GOOGLE_CHAT_WEBHOOK_URL")) {
        console.log("Sending Google Chat");
        try {
            await axios.post(getSecret("NOTIFICATION_GOOGLE_CHAT_WEBHOOK_URL"), {
                text: message,
            });
            console.log("Success Google Chat");
        }
        catch (error) {
            logNotificationError("Google Chat", error);
        }
        console.log("Finished sending Google Chat");
    }
    if (getSecret("NOTIFICATION_ZULIP_MESSAGE_URL") &&
        getSecret("NOTIFICATION_ZULIP_API_EMAIL") &&
        getSecret("NOTIFICATION_ZULIP_API_KEY")) {
        console.log("Sending Zulip");
        try {
            await axios.request({
                method: "post",
                url: getSecret("NOTIFICATION_ZULIP_MESSAGE_URL"),
                auth: {
                    username: getSecret("NOTIFICATION_ZULIP_API_EMAIL"),
                    password: getSecret("NOTIFICATION_ZULIP_API_KEY"),
                },
                params: {
                    content: message,
                },
            });
            console.log("Success Zulip");
        }
        catch (error) {
            logNotificationError("Zulip", error);
        }
        console.log("Finished sending Zulip");
    }
    if (getSecret("NOTIFICATION_MASTODON") && getSecret("NOTIFICATION_MASTODON_INSTANCE_URL") && getSecret("NOTIFICATION_MASTODON_API_KEY")) {
        console.log("Sending Mastodon");
        const instanceUrl = new URL(getSecret("NOTIFICATION_MASTODON_INSTANCE_URL"));
        const baseUrl = `${instanceUrl.protocol}://${instanceUrl.hostname}/api`;
        let visibility = "public";
        if (getSecret("NOTIFICATION_MASTODON_TOOT_VISIBILITY")) {
            try {
                visibility = getSecret("NOTIFICATION_MASTODON_TOOT_VISIBILITY");
            }
            catch (e) {
                console.log(`Unsupported Mastodon toot visibility mode: ${getSecret("NOTIFICATION_MASTODON_TOOT_VISIBILITY")}`);
            }
        }
        await axios.post(`${baseUrl}/v1/statuses`, {
            visibility: visibility,
            status: message,
        }, {
            headers: {
                "Authorization": `Bearer ${getSecret("NOTIFICATION_MASTODON_API_KEY")}`
            }
        });
    }
    if (getSecret("NOTIFICATION_MISSKEY") && getSecret("NOTIFICATION_MISSKEY_INSTANCE_URL") && getSecret("NOTIFICATION_MISSKEY_API_KEY")) {
        console.log("Sending Misskey");
        const instanceUrl = new URL(getSecret("NOTIFICATION_MISSKEY_INSTANCE_URL"));
        const baseUrl = `${instanceUrl.protocol}://${instanceUrl.hostname}/api`;
        if (getSecret("NOTIFICATION_MISSKEY_CHAT") && getSecret("NOTIFICATION_MISSKEY_CHAT_USER_ID")) {
            await axios.post(`${baseUrl}/messaging/messages/create`, {
                i: getSecret("NOTIFICATION_MISSKEY_API_KEY"),
                userId: getSecret("NOTIFICATION_MISSKEY_CHAT_USER_ID"),
                text: message,
            });
        }
        if (getSecret("NOTIFICATION_MISSKEY_NOTE")) {
            let visibility = "public";
            let visibleUserIds;
            if (getSecret("NOTIFICATION_MISSKEY_NOTE_VISIBILITY")) {
                try {
                    visibility = getSecret("NOTIFICATION_MISSKEY_NOTE_VISIBILITY");
                }
                catch (e) {
                    console.log(`Unsupported Misskey note visibility mode: ${getSecret("NOTIFICATION_MISSKEY_NOTE_VISIBILITY")}`);
                }
            }
            if (visibility == "specified") {
                visibleUserIds = (getSecret("NOTIFICATION_MISSKEY_NOTE_VISIBLE_USER_IDS") || "").split(",");
            }
            await axios.post(`${baseUrl}/notes/create`, {
                i: getSecret("NOTIFICATION_MISSKEY_API_KEY"),
                visibility: visibility,
                visibleUserIds: visibleUserIds,
                text: message,
            });
        }
        console.log("Success Misskey");
    }
    if (getSecret("NOTIFICATION_TELEGRAM") && getSecret("NOTIFICATION_TELEGRAM_BOT_KEY")) {
        console.log("Sending Telegram");
        try {
            const chatIds = getSecret("NOTIFICATION_TELEGRAM_CHAT_ID")?.split(",") ?? [];
            for (const chatId of chatIds) {
                await axios.post(`https://api.telegram.org/bot${getSecret("NOTIFICATION_TELEGRAM_BOT_KEY")}/sendMessage`, {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: chatId.trim(),
                    text: formatTelegramHtmlMessage(message),
                });
            }
            console.log("Success Telegram");
        }
        catch (error) {
            logNotificationError("Telegram", error);
        }
        console.log("Finished sending Telegram");
    }
    if (getSecret("NOTIFICATION_LARK")) {
        console.log("Sending Lark");
        try {
            await axios.post(`${getSecret("NOTIFICATION_LARK_BOT_WEBHOOK")}`, {
                "msg_type": "interactive",
                "card": {
                    "config": {
                        "wide_screen_mode": true
                    },
                    "elements": [
                        {
                            "tag": "markdown",
                            "content": message.replace(/_/g, '\\_'),
                        }
                    ]
                }
            });
            console.log("Success Lark");
        }
        catch (error) {
            logNotificationError("Lark", error);
        }
        console.log("Finished sending Lark");
    }
    if (getSecret("NOTIFICATION_TEAMS")) {
        console.log("Sending Microsoft Teams");
        try {
            await axios.post(`${getSecret("NOTIFICATION_TEAMS_WEBHOOK_URL")}`, createTeamsAdaptiveCardPayload(message));
            console.log("Success Microsoft Teams");
        }
        catch (error) {
            logNotificationError("Microsoft Teams", error);
        }
        console.log("Finished sending Microsoft Teams");
    }
    if (getSecret("NOTIFICATION_CUSTOM_WEBHOOK")) {
        console.log("Sending Webhook");
        try {
            await axios.post(`${getSecret("NOTIFICATION_CUSTOM_WEBHOOK_URL")}`, {
                data: {
                    message: JSON.stringify(message),
                }
            }, {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            console.log("Success Webhook");
        }
        catch (error) {
            logNotificationError("Webhook", error);
        }
        console.log("Finished sending Webhook");
    }
    if (getSecret("NOTIFICATION_GOTIFY")) {
        console.log("Sending Gotify");
        try {
            await axios.post(`${getSecret("NOTIFICATION_GOTIFY_URL")}/message?token=${getSecret("NOTIFICATION_GOTIFY_TOKEN")}`, {
                message: message,
                title: (getSecret("NOTIFICATION_GOTIFY_TITLE") || "Upptime"),
                priority: (getSecret("NOTIFICATION_GOTIFY_PRIORITY") || 5),
            });
            console.log("Success Gotify");
        }
        catch (error) {
            logNotificationError("Gotify", error);
        }
        console.log("Finished sending Gotify");
    }
};
//# sourceMappingURL=notifme.js.map