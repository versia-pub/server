import { markdownParse } from "~/database/entities/Status";
import { LogLevel } from "~/packages/log-manager";
import { dualLogger } from "./loggers";

export const renderMarkdownInPath = async (
    path: string,
    defaultText?: string,
) => {
    let content = await markdownParse(defaultText ?? "");
    let lastModified = new Date(1970, 0, 0);

    const extended_description_file = Bun.file(path || "");

    if (path && (await extended_description_file.exists())) {
        content =
            (await markdownParse(
                (await extended_description_file.text().catch(async (e) => {
                    await dualLogger.logError(LogLevel.ERROR, "Routes", e);
                    return "";
                })) ||
                    defaultText ||
                    "",
            )) || "";
        lastModified = new Date(extended_description_file.lastModified);
    }

    return {
        content: content,
        lastModified,
    };
};
