import type { ContentFormat } from "@versia/federation/types";
import { htmlToText as htmlToTextLib } from "html-to-text";
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
    url: URL,
    contentType?: string,
): ContentFormat | null => {
    if (url.href.startsWith("https://api.dicebear.com/")) {
        return {
            "image/svg+xml": {
                content: url.toString(),
                remote: true,
            },
        };
    }
    const mimeType =
        contentType ||
        lookup(url.toString().replace(url.search, "")) ||
        "application/octet-stream";

    return {
        [mimeType]: {
            content: url.toString(),
            remote: true,
        },
    };
};

export const mimeLookup = (url: URL): Promise<string> => {
    const urlWithoutSearch = url.toString().replace(url.search, "");

    // Strip query params from URL to get the proper file extension
    const naiveLookup = lookup(urlWithoutSearch);

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

export const htmlToText = (html: string): string => {
    return htmlToTextLib(html, {
        selectors: [
            {
                selector: "a",
                options: {
                    hideLinkHrefIfSameAsText: true,
                    ignoreHref: true,
                },
            },
        ],
    });
};
