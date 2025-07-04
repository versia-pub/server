import markdownItTaskLists from "@hackmd/markdown-it-task-lists";
import MarkdownIt from "markdown-it";
import markdownItContainer from "markdown-it-container";
import markdownItTocDoneRight from "markdown-it-toc-done-right";

const createMarkdownIt = (): MarkdownIt => {
    const renderer = MarkdownIt({
        html: true,
        linkify: true,
    });

    renderer.use(markdownItTocDoneRight, {
        containerClass: "toc",
        level: [1, 2, 3, 4],
        listType: "ul",
        listClass: "toc-list",
        itemClass: "toc-item",
        linkClass: "toc-link",
    });

    renderer.use(markdownItTaskLists);

    renderer.use(markdownItContainer);

    return renderer;
};

/**
 * Converts markdown text to HTML using MarkdownIt.
 * @param content
 * @returns
 */
export const markdownToHtml = async (content: string): Promise<string> => {
    return (await createMarkdownIt()).render(content);
};
