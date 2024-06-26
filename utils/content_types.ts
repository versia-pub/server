import type { ContentFormat } from "@lysand-org/federation/types";
import { lookup } from "mime-types";
import { config } from "~/packages/config-manager";

export const getBestContentType = (content?: ContentFormat) => {
    if (!content) {
        return { content: "", format: "text/plain" };
    }

    const bestFormatsRanked = [
        "text/x.misskeymarkdown",
        "text/html",
        "text/markdown",
        "text/plain",
    ];

    for (const format of bestFormatsRanked) {
        if (content[format]) {
            return { content: content[format].content, format };
        }
    }

    return { content: "", format: "text/plain" };
};

export const urlToContentFormat = (url?: string): ContentFormat | null => {
    if (!url) {
        return null;
    }
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

export const mimeLookup = async (url: string) => {
    const naiveLookup = lookup(url.replace(new URL(url).search, ""));

    if (naiveLookup) {
        return naiveLookup;
    }

    const fetchLookup = fetch(url, {
        method: "HEAD",
        proxy: config.http.proxy.address,
    }).then((response) => response.headers.get("content-type") || "");

    return fetchLookup;
};
