import {
    anyOf,
    caseInsensitive,
    charIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    maybe,
    oneOrMore,
} from "magic-regexp";

export const uuid = createRegExp(
    anyOf(digit, charIn("ABCDEF")).times(8),
    exactly("-"),
    anyOf(digit, charIn("ABCDEF")).times(4),
    exactly("-"),
    exactly("7"),
    anyOf(digit, charIn("ABCDEF")).times(3),
    exactly("-"),
    anyOf("8", "9", "A", "B").times(1),
    anyOf(digit, charIn("ABCDEF")).times(3),
    exactly("-"),
    anyOf(digit, charIn("ABCDEF")).times(12),
    [caseInsensitive],
);

export const mention = createRegExp(
    exactly("@"),
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-_"))).groupedAs(
        "username",
    ),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [global],
);

export const webfingerMention = createRegExp(
    exactly("acct:"),
    oneOrMore(anyOf(letter, digit, charIn("-_"))).groupedAs("username"),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [],
);
