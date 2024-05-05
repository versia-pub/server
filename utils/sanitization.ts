import { stringifyEntitiesLight } from "stringify-entities";
import xss, { type IFilterXSSOptions } from "xss";

export const sanitizedHtmlStrip = (html: string) => {
    return sanitizeHtml(html, {
        whiteList: {},
    });
};

export const sanitizeHtml = async (
    html: string,
    extraConfig?: IFilterXSSOptions,
) => {
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
        },
        stripIgnoreTag: false,
        escapeHtml: (unsafeHtml) =>
            stringifyEntitiesLight(unsafeHtml, {
                escapeOnly: true,
            }),
        ...extraConfig,
    });

    // Check text to only allow h-*, p-*, u-*, dt-*, e-*, mention, hashtag, ellipsis, invisible classes
    const allowedClasses = [
        "h-",
        "p-",
        "u-",
        "dt-",
        "e-",
        "mention",
        "hashtag",
        "ellipsis",
        "invisible",
    ];

    return await new HTMLRewriter()
        .on("*[class]", {
            element(element) {
                const classes = element.getAttribute("class")?.split(" ") ?? [];

                for (const className of classes) {
                    if (
                        !allowedClasses.some((allowedClass) =>
                            className.startsWith(allowedClass),
                        )
                    ) {
                        element.removeAttribute("class");
                    }
                }
            },
        })
        .transform(new Response(sanitizedHtml))
        .text();
};
