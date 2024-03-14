import { errorResponse, jsonResponse } from "@response";
import { userToAPI } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";
import { client } from "~database/datasource";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/search",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
		oauthPermissions: ["read:accounts"],
	},
});

export default apiRoute<{
	q?: string;
	limit?: number;
	offset?: number;
	resolve?: boolean;
	following?: boolean;
}>(async (req, matchedRoute, extraData) => {
	// TODO: Add checks for disabled or not email verified accounts

	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	const {
		following = false,
		limit = 40,
		offset,
		q,
	} = extraData.parsedRequest;

	if (limit < 1 || limit > 80) {
		return errorResponse("Limit must be between 1 and 80", 400);
	}

	// TODO: Add WebFinger resolve

	const accounts = await client.user.findMany({
		where: {
			OR: [
				{
					displayName: {
						contains: q,
					},
				},
				{
					username: {
						contains: q,
					},
				},
			],
			relationshipSubjects: following
				? {
						some: {
							ownerId: user.id,
							following,
						},
					}
				: undefined,
		},
		take: Number(limit),
		skip: Number(offset || 0),
		include: userRelations,
	});

	return jsonResponse(accounts.map(acct => userToAPI(acct)));
});
