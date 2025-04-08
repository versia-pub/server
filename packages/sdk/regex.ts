import {
    charIn,
    charNotIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    not,
    oneOrMore,
} from "magic-regexp";

export const semverRegex: RegExp = new RegExp(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/gm,
);

/**
 * Regular expression for matching an extension_type
 * @example pub.versia:custom_emojis/Emoji
 */
export const extensionTypeRegex: RegExp = createRegExp(
    // org namespace, then colon, then alphanumeric/_/-, then extension name
    exactly(
        oneOrMore(exactly(letter.lowercase.or(digit).or(charIn("_-.")))),
        exactly(":"),
        oneOrMore(exactly(letter.lowercase.or(digit).or(charIn("_-")))),
        exactly("/"),
        oneOrMore(exactly(letter.or(digit).or(charIn("_-")))),
    ),
);

/**
 * Regular expression for matching an extension
 * @example pub.versia:custom_emojis
 */
export const extensionRegex: RegExp = createRegExp(
    // org namespace, then colon, then alphanumeric/_/-, then extension name
    exactly(
        oneOrMore(exactly(letter.lowercase.or(digit).or(charIn("_-.")))),
        exactly(":"),
        oneOrMore(exactly(letter.lowercase.or(digit).or(charIn("_-")))),
    ),
);

/**
 * Regular expression for matching emojis.
 */
export const emojiRegex: RegExp = createRegExp(
    exactly(
        exactly(not.letter.or(not.digit).or(charNotIn("_-"))).times(1),
        oneOrMore(letter.or(digit).or(charIn("_-"))),
        exactly(not.letter.or(not.digit).or(charNotIn("_-"))).times(1),
    ),
    [global],
);

// This will accept a lot of stuff that isn't an ISO string
// but ISO validation is incredibly complex so fuck it
export const isISOString = (val: string | Date): boolean => {
    const d = new Date(val);
    return !Number.isNaN(d.valueOf());
};

export const ianaTimezoneRegex = /^(?:[A-Za-z]+(?:\/[A-Za-z_]+)+|UTC)$/;
