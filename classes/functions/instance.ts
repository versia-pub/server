import type { ServerMetadata } from "@lysand-org/federation/types";
import { db } from "~/drizzle/db";
import { Instances } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";

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

    const found = await db.query.Instances.findFirst({
        where: (instance, { eq }) => eq(instance.baseUrl, host),
    });

    if (found) {
        return found;
    }

    // Fetch the instance configuration
    const metadata = (await fetch(new URL("/.well-known/lysand", origin), {
        proxy: config.http.proxy.address,
    }).then((res) => res.json())) as ServerMetadata;

    if (metadata.type !== "ServerMetadata") {
        throw new Error("Invalid instance metadata (wrong type)");
    }

    if (!(metadata.name && metadata.version)) {
        throw new Error("Invalid instance metadata (missing name or version)");
    }

    return (
        await db
            .insert(Instances)
            .values({
                baseUrl: host,
                name: metadata.name,
                version: metadata.version,
                logo: metadata.logo,
            })
            .returning()
    )[0];
};
