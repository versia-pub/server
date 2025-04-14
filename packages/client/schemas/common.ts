import ISO6391 from "iso-639-1";
import { z } from "zod";
import "zod-openapi/extend";

export const Id = z.string().uuid();

export const iso631 = z
    .enum(ISO6391.getAllCodes() as [string, ...string[]])
    .openapi({
        description: "ISO 639-1 language code",
        example: "en",
        externalDocs: {
            url: "https://en.wikipedia.org/wiki/List_of_ISO_639-1_language_codes",
        },
        ref: "ISO631",
    });

export const zBoolean = z
    .string()
    .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
    .openapi({ type: "boolean" })
    .or(z.boolean());
