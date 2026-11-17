import { readFile } from "fs-extra";
import { load } from "js-yaml";
import { join } from "path";
let __config = undefined;
export const getConfig = async () => {
    if (__config)
        return __config;
    const config = load(await readFile(join(".", ".upptimerc.yml"), "utf8"));
    __config = config;
    return config;
};
//# sourceMappingURL=config.js.map