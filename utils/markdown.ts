import { markdownParse } from "~/database/entities/status";
import { LogLevel } from "~/packages/log-manager";
import { dualLogger } from "./loggers";

export const renderMarkdownInPath = async (
    path: string,
    defaultText?: string,
) => {
    let content = await markdownParse(defaultText ?? "");
    let lastModified = new Date(1970, 0, 0);

    const extendedDescriptionFile = Bun.file(path || "");

    if (path && (await extendedDescriptionFile.exists())) {
        content =
            (await markdownParse(
                (await extendedDescriptionFile.text().catch(async (e) => {
                    await dualLogger.logError(LogLevel.Error, "Routes", e);
                    return "";
                })) ||
                    defaultText ||
                    "",
            )) || "";
        lastModified = new Date(extendedDescriptionFile.lastModified);
    }

    return {
        content: content,
        lastModified,
    };
};
