import tcpp from "tcp-ping";
/**
 * Promisified TCP pinging
 * @param options - tcpp.ping options
 */
export const ping = (options) => new Promise((resolve, reject) => {
    tcpp.ping(options, (error, data) => {
        if (error)
            return reject(error);
        resolve(data);
    });
});
//# sourceMappingURL=ping.js.map