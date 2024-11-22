import { stringifyEntitiesLight } from "stringify-entities";
import xss, { type IFilterXSSOptions } from "xss";
import { proxyUrl } from "./response.ts";

export const sanitizedHtmlStrip = (html: string): Promise<string> => {
    return sanitizeHtml(html, {
        whiteList: {},
    });
};

export const sanitizeHtmlInline = (
    html: string,
    extraConfig?: IFilterXSSOptions,
): Promise<string> => {
    return sanitizeHtml(html, {
        whiteList: {
            a: ["href", "title", "target", "rel", "class"],
            p: ["class"],
            b: ["class"],
            i: ["class"],
            em: ["class"],
            strong: ["class"],
            del: ["class"],
            u: ["class"],
            font: ["color", "size", "face", "class"],
            strike: ["class"],
            mark: ["class"],
            small: ["class"],
        },
        ...extraConfig,
    });
};

export const sanitizeHtml = async (
    html: string,
    extraConfig?: IFilterXSSOptions,
): Promise<string> => {
    const sanitizedHtml = xss(html, {
        whiteList: {
            a: ["href", "title", "target", "rel", "class"],
            p: ["class"],
            br: ["class"],
            b: ["class"],
            i: ["class"],
            em: ["class"],
            strong: ["class"],
            del: ["class"],
            code: ["class"],
            u: ["class"],
            pre: ["class"],
            ul: ["class"],
            ol: ["class"],
            li: ["class"],
            blockquote: ["class"],
            h1: ["class"],
            h2: ["class"],
            h3: ["class"],
            h4: ["class"],
            h5: ["class"],
            h6: ["class"],
            img: ["src", "alt", "title", "class"],
            font: ["color", "size", "face", "class"],
            table: ["class"],
            tr: ["class"],
            td: ["class"],
            th: ["class"],
            tbody: ["class"],
            thead: ["class"],
            tfoot: ["class"],
            hr: ["class"],
            strike: ["class"],
            figcaption: ["class"],
            figure: ["class"],
            mark: ["class"],
            summary: ["class"],
            details: ["class"],
            caption: ["class"],
            small: ["class"],
            video: ["class", "src", "controls"],
            audio: ["class", "src", "controls"],
            source: ["src", "type"],
            track: ["src", "label", "kind"],
            input: ["type", "checked", "disabled", "class"],
            span: ["class", "translate"],
            div: ["class"],
        },
        stripIgnoreTag: false,
        escapeHtml: (unsafeHtml): string =>
            stringifyEntitiesLight(unsafeHtml, {
                escapeOnly: true,
            }),
        ...extraConfig,
    });

    // Check text to only allow h-*, p-*, u-*, dt-*, e-*, mention, hashtag, ellipsis, invisible classes
    const allowedClassesStart = ["h-", "p-", "u-", "dt-", "e-"];

    const allowedClasses = [
        "mention",
        "hashtag",
        "ellipsis",
        "invisible",
        "task-list-item-checkbox",
    ];

    return await new HTMLRewriter()
        .on("*[class]", {
            element(element): void {
                const classes = element.getAttribute("class")?.split(" ") ?? [];

                for (const className of classes) {
                    if (
                        !(
                            allowedClassesStart.some((allowedClass) =>
                                className.startsWith(allowedClass),
                            ) && allowedClasses.includes(className)
                        )
                    ) {
                        element.removeAttribute("class");
                    }
                }
            },
        })
        // Only allow disabled checkbox input
        .on("input", {
            element(element): void {
                if (element.getAttribute("type") === "checkbox") {
                    element.setAttribute("disabled", "");
                } else {
                    element.remove();
                }
            },
        })
        // Rewrite all src tags to go through proxy
        .on("[src]", {
            element(element): void {
                element.setAttribute(
                    "src",
                    proxyUrl(element.getAttribute("src") ?? "") ?? "",
                );
            },
        })
        .transform(new Response(sanitizedHtml))
        .text();
};
