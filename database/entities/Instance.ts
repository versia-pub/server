import type { Instance } from "@prisma/client";
import { client } from "~database/datasource";
import type { ServerMetadata } from "~types/lysand/Object";

/**
 * Represents an instance in the database.
 */

/**
 * Adds an instance to the database if it doesn't already exist.
 * @param url
 * @returns Either the database instance if it already exists, or a newly created instance.
 */
export const addInstanceIfNotExists = async (
	url: string
): Promise<Instance> => {
	const origin = new URL(url).origin;
	const hostname = new URL(url).hostname;

	const found = await client.instance.findFirst({
		where: {
			base_url: hostname,
		},
	});

	if (found) return found;

	// Fetch the instance configuration
	const metadata = (await fetch(`${origin}/.well-known/lysand`).then(res =>
		res.json()
	)) as Partial<ServerMetadata>;

	if (metadata.type !== "ServerMetadata") {
		throw new Error("Invalid instance metadata");
	}

	if (!(metadata.name && metadata.version)) {
		throw new Error("Invalid instance metadata");
	}

	return await client.instance.create({
		data: {
			base_url: hostname,
			name: metadata.name,
			version: metadata.version,
			logo: metadata.logo as any,
		},
	});
};
