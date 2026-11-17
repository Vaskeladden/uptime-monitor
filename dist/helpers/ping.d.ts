import type { Options, Result } from "tcp-ping";
/**
 * Promisified TCP pinging
 * @param options - tcpp.ping options
 */
export declare const ping: (options: Options) => Promise<Result>;
