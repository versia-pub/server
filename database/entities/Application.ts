import type { InferSelectModel } from "drizzle-orm";
import { db } from "~drizzle/db";
import type { application } from "~drizzle/schema";
import type { Application as APIApplication } from "~types/mastodon/application";

export type Application = InferSelectModel<typeof application>;

/**
 * Retrieves the application associated with the given access token.
 * @param token The access token to retrieve the application for.
 * @returns The application associated with the given access token, or null if no such application exists.
 */
export const getFromToken = async (
    token: string,
): Promise<Application | null> => {
    const result = await db.query.token.findFirst({
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
export const applicationToAPI = (app: Application): APIApplication => {
    return {
        name: app.name,
        website: app.website,
        vapid_key: app.vapidKey,
    };
};
