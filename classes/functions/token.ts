import type { Tokens } from "@versia/kit/tables";
import type { InferSelectModel } from "drizzle-orm";

/**
 * The type of token.
 */
export enum TokenType {
    Bearer = "Bearer",
}

export type Token = InferSelectModel<typeof Tokens>;
