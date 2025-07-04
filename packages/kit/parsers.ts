import type * as VersiaEntities from "@versia/sdk/entities";
import { FederationRequester } from "@versia/sdk/http";
import { config } from "@versia-server/config";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import linkifyHtml from "linkify-html";
import {
    anyOf,
    charIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
} from "magic-regexp";
import { sanitizeHtml, sanitizeHtmlInline } from "@/sanitization";
import { User } from "./db/user.ts";
import { markdownToHtml } from "./markdown.ts";
import { mention } from "./regex.ts";
import { db } from "./tables/db.ts";
import { Instances, Users } from "./tables/schema.ts";

/**
 * Get people mentioned in the content (match @username or @username@domain.com mentions)
 * @param text The text to parse mentions from.
 * @returns An array of users mentioned in the text.
 */
export const parseMentionsFromText = async (text: string): Promise<User[]> => {
    const mentionedPeople = [...text.matchAll(mention)];
    if (mentionedPeople.length === 0) {
        return [];
    }

    const baseUrlHost = config.http.base_url.host;
    const isLocal = (host?: string): boolean => host === baseUrlHost || !host;

    // Find local and matching users
    const foundUsers = await db
        .select({
            id: Users.id,
            username: Users.username,
            baseUrl: Instances.baseUrl,
        })
        .from(Users)
        .leftJoin(Instances, eq(Users.instanceId, Instances.id))
        .where(
            or(
                ...mentionedPeople.map((person) =>
                    and(
                        eq(Users.username, person[1] ?? ""),
                        isLocal(person[2])
                            ? isNull(Users.instanceId)
                            : eq(Instances.baseUrl, person[2] ?? ""),
                    ),
                ),
            ),
        );

    // Separate found and unresolved users
    const finalList = await User.manyFromSql(
        inArray(
            Users.id,
            foundUsers.map((u) => u.id),
        ),
    );

    // Every remote user that isn't in database
    const notFoundRemoteUsers = mentionedPeople.filter(
        (p) =>
            !(
                foundUsers.some(
                    (user) => user.username === p[1] && user.baseUrl === p[2],
                ) || isLocal(p[2])
            ),
    );

    // Resolve remote mentions not in database
    for (const person of notFoundRemoteUsers) {
        const url = await FederationRequester.resolveWebFinger(
            person[1] ?? "",
            person[2] ?? "",
        );

        if (url) {
            const user = await User.resolve(url);

            if (user) {
                finalList.push(user);
            }
        }
    }

    return finalList;
};

export const linkifyUserMentions = (text: string, mentions: User[]): string => {
    return mentions.reduce((finalText, mention) => {
        const { username, instance } = mention.data;
        const { uri } = mention;
        const baseHost = config.http.base_url.host;
        const linkTemplate = (displayText: string): string =>
            `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${uri}">${displayText}</a>`;

        if (mention.remote) {
            return finalText.replaceAll(
                `@${username}@${instance?.baseUrl}`,
                linkTemplate(`@${username}@${instance?.baseUrl}`),
            );
        }

        return finalText.replace(
            createRegExp(
                exactly(
                    exactly(`@${username}`)
                        .notBefore(anyOf(letter, digit, charIn("@")))
                        .notAfter(anyOf(letter, digit, charIn("@"))),
                ).or(exactly(`@${username}@${baseHost}`)),
                [global],
            ),
            linkTemplate(`@${username}@${baseHost}`),
        );
    }, text);
};

export const versiaTextToHtml = async (
    content: VersiaEntities.TextContentFormat,
    mentions: User[] = [],
    inline = false,
): Promise<string> => {
    const sanitizer = inline ? sanitizeHtmlInline : sanitizeHtml;
    let htmlContent = "";

    if (content.data["text/html"]) {
        htmlContent = await sanitizer(content.data["text/html"].content);
    } else if (content.data["text/markdown"]) {
        htmlContent = await sanitizer(
            await markdownToHtml(content.data["text/markdown"].content),
        );
    } else if (content.data["text/plain"]?.content) {
        htmlContent = (await sanitizer(content.data["text/plain"].content))
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("\n");
    }

    htmlContent = linkifyUserMentions(htmlContent, mentions);

    return linkifyHtml(htmlContent, {
        defaultProtocol: "https",
        validate: { email: (): false => false },
        target: "_blank",
        rel: "nofollow noopener noreferrer",
    });
};

export const parseUserAddress = (
    address: string,
): {
    username: string;
    domain?: string;
} => {
    let output = address;
    // Remove leading @ if it exists
    if (output.startsWith("@")) {
        output = output.slice(1);
    }

    const [username, domain] = output.split("@");
    return { username, domain };
};
