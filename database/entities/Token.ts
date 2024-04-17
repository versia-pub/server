import type { InferSelectModel } from "drizzle-orm";
import type { Tokens } from "~drizzle/schema";

/**
 * The type of token.
 */
export enum TokenType {
    BEARER = "Bearer",
}

export type Token = InferSelectModel<typeof Tokens>;
