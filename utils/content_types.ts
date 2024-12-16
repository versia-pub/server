import type { ContentFormat } from "@versia/federation/types";
import { lookup } from "mime-types";
import { config } from "~/packages/config-manager";

export const getBestContentType = (
    content?: ContentFormat | null,
): {
    content: string;
    format: string;
} => {
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

export const urlToContentFormat = (
    url: string,
    contentType?: string,
): ContentFormat | null => {
    if (!url) {
        return null;
    }
    if (url.startsWith("https://api.dicebear.com/")) {
        return {
            "image/svg+xml": {
                content: url,
                remote: true,
            },
        };
    }
    const mimeType =
        contentType ||
        lookup(url.replace(new URL(url).search, "")) ||
        "application/octet-stream";

    return {
        [mimeType]: {
            content: url,
            remote: true,
        },
    };
};

export const mimeLookup = (url: string): Promise<string> => {
    const naiveLookup = lookup(url.replace(new URL(url).search, ""));

    if (naiveLookup) {
        return Promise.resolve(naiveLookup);
    }

    const fetchLookup = fetch(url, {
        method: "HEAD",
        // @ts-expect-error Proxy is a Bun-specific feature
        proxy: config.http.proxy.address,
    })
        .then(
            (response) =>
                response.headers.get("content-type") ||
                "application/octet-stream",
        )
        .catch(() => "application/octet-stream");

    return fetchLookup;
};
