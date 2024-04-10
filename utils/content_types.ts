import type * as Lysand from "lysand-types";
import { lookup } from "mime-types";

export const getBestContentType = (content?: Lysand.ContentFormat) => {
    if (!content) return { content: "", format: "text/plain" };

    const bestFormatsRanked = [
        "text/x.misskeymarkdown",
        "text/html",
        "text/markdown",
        "text/plain",
    ];

    for (const format of bestFormatsRanked) {
        if (content[format])
            return { content: content[format].content, format };
    }

    return { content: "", format: "text/plain" };
};

export const urlToContentFormat = (
    url: string,
): Lysand.ContentFormat | null => {
    if (!url) return null;
    if (url.startsWith("https://api.dicebear.com/")) {
        return {
            "image/svg+xml": {
                content: url,
            },
        };
    }
    const mimeType =
        lookup(url.replace(new URL(url).search, "")) ||
        "application/octet-stream";

    return {
        [mimeType]: {
            content: url,
        },
    };
};
