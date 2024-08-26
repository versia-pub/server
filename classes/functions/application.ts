import type { Application as APIApplication } from "@versia/client/types";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "~/drizzle/db";
import type { Applications } from "~/drizzle/schema";

export type Application = InferSelectModel<typeof Applications>;

/**
 * Retrieves the application associated with the given access token.
 * @param token The access token to retrieve the application for.
 * @returns The application associated with the given access token, or null if no such application exists.
 */
export const getFromToken = async (
    token: string,
): Promise<Application | null> => {
    const result = await db.query.Tokens.findFirst({
        where: (tokens, { eq }) => eq(tokens.accessToken, token),
        with: {
            application: true,
        },
    });

    return result?.application || null;
};

/**
 * Converts this application to an API application.
 * @returns The API application representation of this application.
 */
export const applicationToApi = (app: Application): APIApplication => {
    return {
        name: app.name,
        website: app.website,
        vapid_key: app.vapidKey,
    };
};
