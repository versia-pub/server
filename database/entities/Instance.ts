import { db } from "~drizzle/db";
import type * as Lysand from "lysand-types";
import { instance } from "~drizzle/schema";

/**
 * Represents an instance in the database.
 */

/**
 * Adds an instance to the database if it doesn't already exist.
 * @param url
 * @returns Either the database instance if it already exists, or a newly created instance.
 */
export const addInstanceIfNotExists = async (url: string) => {
    const origin = new URL(url).origin;
    const host = new URL(url).host;

    const found = await db.query.instance.findFirst({
        where: (instance, { eq }) => eq(instance.baseUrl, host),
    });

    if (found) return found;

    console.log(`Fetching instance metadata for ${origin}`);

    // Fetch the instance configuration
    const metadata = (await fetch(new URL("/.well-known/lysand", origin)).then(
        (res) => res.json(),
    )) as Lysand.ServerMetadata;

    if (metadata.type !== "ServerMetadata") {
        throw new Error("Invalid instance metadata (wrong type)");
    }

    if (!(metadata.name && metadata.version)) {
        throw new Error("Invalid instance metadata (missing name or version)");
    }

    return (
        await db
            .insert(instance)
            .values({
                baseUrl: host,
                name: metadata.name,
                version: metadata.version,
                logo: metadata.logo,
            })
            .returning()
    )[0];
};
