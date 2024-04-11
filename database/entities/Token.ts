import type { InferSelectModel } from "drizzle-orm";
import type { token } from "~drizzle/schema";

/**
 * The type of token.
 */
export enum TokenType {
    BEARER = "Bearer",
}

export type Token = InferSelectModel<typeof token>;
