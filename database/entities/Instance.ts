import type { Instance } from "@prisma/client";
import { client } from "~database/datasource";
import type * as Lysand from "lysand-types";

/**
 * Represents an instance in the database.
 */

/**
 * Adds an instance to the database if it doesn't already exist.
 * @param url
 * @returns Either the database instance if it already exists, or a newly created instance.
 */
export const addInstanceIfNotExists = async (
    url: string,
): Promise<Instance> => {
    const origin = new URL(url).origin;
    const host = new URL(url).host;

    const found = await client.instance.findFirst({
        where: {
            base_url: host,
        },
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

    return await client.instance.create({
        data: {
            base_url: host,
            name: metadata.name,
            version: metadata.version,
            logo: metadata.logo,
        },
    });
};
