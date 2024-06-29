import { emojiValidatorWithColons } from "@/api";
import { type InferSelectModel, inArray } from "drizzle-orm";
import { Emojis, type Instances } from "~/drizzle/schema";
import { Emoji } from "~/packages/database-interface/emoji";

export type EmojiWithInstance = InferSelectModel<typeof Emojis> & {
    instance: InferSelectModel<typeof Instances> | null;
};

/**
 * Used for parsing emojis from local text
 * @param text The text to parse
 * @returns An array of emojis
 */
export const parseEmojis = async (text: string): Promise<Emoji[]> => {
    const matches = text.match(emojiValidatorWithColons);
    if (!matches || matches.length === 0) {
        return [];
    }

    return Emoji.manyFromSql(
        inArray(
            Emojis.shortcode,
            matches.map((match) => match.replace(/:/g, "")),
        ),
    );
};
