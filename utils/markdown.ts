import { getLogger } from "@logtape/logtape";
import { markdownParse } from "~/classes/functions/status";
import { sentry } from "./sentry";

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
                    await getLogger("server").error`${e}`;
                    sentry?.captureException(e);
                    return "";
                })) ||
                    defaultText ||
                    "",
            )) || "";
        lastModified = new Date(extendedDescriptionFile.lastModified);
    }

    return {
        content,
        lastModified,
    };
};
