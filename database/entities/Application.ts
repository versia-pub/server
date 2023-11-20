import { APIApplication } from "~types/entities/application";
import { Application } from "@prisma/client";
import { client } from "~database/datasource";

/**
 * Represents an application that can authenticate with the API.
 */

/**
 * Retrieves the application associated with the given access token.
 * @param token The access token to retrieve the application for.
 * @returns The application associated with the given access token, or null if no such application exists.
 */
export const getFromToken = async (
	token: string
): Promise<Application | null> => {
	const dbToken = await client.token.findFirst({
		where: {
			access_token: token,
		},
		include: {
			application: true,
		},
	});

	return dbToken?.application || null;
};

/**
 * Converts this application to an API application.
 * @returns The API application representation of this application.
 */
export const applicationToAPI = (app: Application): APIApplication => {
	return {
		name: app.name,
		website: app.website,
		vapid_key: app.vapid_key,
	};
};
