import { sanitizeHtml } from "@sanitization";
import linkifyHtml from "linkify-html";
import linkifyStr from "linkify-string";
import { parse } from "marked";

/**
 * Converts plaintext, MFM or Markdown to HTML
 * @param text Text to convert
 * @param content_type Content type of the text (optional, defaults to plaintext)
 * @returns HTML
 */
export const convertTextToHtml = async (
    text: string,
    content_type?: string,
) => {
    if (content_type === "text/markdown") {
        return linkifyHtml(await sanitizeHtml(await parse(text)));
    }
    if (content_type === "text/x.misskeymarkdown") {
        // Parse as MFM
        // TODO: Implement MFM
        return text;
    }
    // Parse as plaintext
    return linkifyStr(text)
        .split("\n")
        .map((line) => `<p>${line}</p>`)
        .join("\n");
};
