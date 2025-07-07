import ISO6391 from "iso-639-1";
import { z } from "zod/v4";

export const Id = z.uuid();

export const iso631 = z
    .enum(ISO6391.getAllCodes() as [string, ...string[]])
    .meta({
        description: "ISO 639-1 language code",
        example: "en",
        externalDocs: {
            url: "https://en.wikipedia.org/wiki/List_of_ISO_639-1_language_codes",
        },
        id: "ISO631",
    });

export const zBoolean = z.stringbool().or(z.boolean());
