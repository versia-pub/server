import {
    anyOf,
    caseInsensitive,
    charIn,
    charNotIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    maybe,
    not,
    oneOrMore,
} from "magic-regexp";

export const userAddressRegex = createRegExp(
    maybe("@"),
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-_"))).groupedAs(
        "username",
    ),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [global],
);

export const emojiRegex = createRegExp(
    // A-Z a-z 0-9 _ -
    oneOrMore(letter.or(digit).or(charIn("_-"))),
    [caseInsensitive, global],
);

export const emojiWithColonsRegex = createRegExp(
    exactly(":"),
    oneOrMore(letter.or(digit).or(charIn("_-"))),
    exactly(":"),
    [caseInsensitive, global],
);

export const emojiWithIdentifiersRegex = createRegExp(
    exactly(
        exactly(not.letter.or(not.digit).or(charNotIn("_-"))).times(1),
        oneOrMore(letter.or(digit).or(charIn("_-"))).groupedAs("shortcode"),
        exactly(not.letter.or(not.digit).or(charNotIn("_-"))).times(1),
    ),
    [caseInsensitive, global],
);
