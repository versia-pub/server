import {
    anyOf,
    char,
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
    whitespace,
} from "magic-regexp/further-magic";

const regexp = createRegExp(
    exactly("@jesse")
        .notBefore(anyOf(letter, digit, charIn("@")))
        .notAfter(anyOf(letter, digit, charIn("@"))),
    [global],
);

console.log(regexp);
console.log("@jessew@game cheese @jesse2 @jesse s".match(regexp));
