import { config } from "config-manager";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

export const sanitizeHtml = async (
    html: string,
    extraConfig?: DOMPurify.Config,
) => {
    const sanitizedHtml = DOMPurify(new JSDOM().window).sanitize(html, {
        ALLOWED_TAGS: [
            "a",
            "p",
            "br",
            "b",
            "i",
            "em",
            "strong",
            "del",
            "code",
            "u",
            "pre",
            "ul",
            "ol",
            "li",
            "blockquote",
        ],
        ALLOWED_ATTR: [
            "href",
            "target",
            "title",
            "rel",
            "class",
            "start",
            "reversed",
            "value",
        ],
        ALLOWED_URI_REGEXP: new RegExp(
            `/^(?:(?:${config.validation.url_scheme_whitelist.join(
                "|",
            )}):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i`,
        ),
        USE_PROFILES: {
            mathMl: true,
        },
        ...extraConfig,
    }) as string;

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
