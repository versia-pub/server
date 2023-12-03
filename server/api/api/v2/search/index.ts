import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { getFromRequest } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 10,
		duration: 60,
	},
	route: "/api/v2/search",
	auth: {
		required: false,
		oauthPermissions: ["read:search"],
	},
});

/**
 * Upload new media
 */
export default async (req: Request): Promise<Response> => {
	const { user } = await getFromRequest(req);

	const {
		q,
		type,
		resolve,
		following,
		account_id,
		max_id,
		min_id,
		limit,
		offset,
	} = await parseRequest<{
		q?: string;
		type?: string;
		resolve?: boolean;
		following?: boolean;
		account_id?: string;
		max_id?: string;
		min_id?: string;
		limit?: number;
		offset?: number;
	}>(req);

	if (!user && (resolve || offset)) {
		return errorResponse(
			"Cannot use resolve or offset without being authenticated",
			401
		);
	}

	return jsonResponse({
		accounts: [],
		statuses: [],
		hashtags: [],
	});
};
