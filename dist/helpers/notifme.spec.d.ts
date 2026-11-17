declare const mockNotifmeSend: jest.Mock<any, any, any>;
declare const mockNotifmeConstructor: jest.Mock<any, any, any>;
declare const originalEnv: NodeJS.ProcessEnv;
declare const loadNotifme: (secrets: Record<string, string>) => {
    formatNotificationError: (error: unknown) => string;
    formatTelegramHtmlMessage: (message: string) => string;
    createTeamsAdaptiveCardPayload: typeof import("./notifme").createTeamsAdaptiveCardPayload;
    sendNotification: (message: string) => Promise<void>;
    axios: {
        post: jest.Mock;
    };
};
