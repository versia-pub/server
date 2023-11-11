import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { UserAction } from "~database/entities/User";
import { APIAccount } from "~types/entities/account";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/familiar_followers",
	ratelimits: {
		max: 30,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

/**
 * Find familiar followers (followers of a user that you also follow)
 */
export default async (req: Request): Promise<Response> => {
	const { user: self } = await UserAction.getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const { "id[]": ids } = await parseRequest<{
		"id[]": string[];
	}>(req);

	// Minimum id count 1, maximum 10
	if (!ids || ids.length < 1 || ids.length > 10) {
		return errorResponse("Number of ids must be between 1 and 10", 422);
	}

	const response = (
		await Promise.all(
			ids.map(async id => {
				// Find followers of user that you also follow

				// Get user
				const user = await UserAction.findOne({
					where: { id },
					relations: {
						relationships: {
							subject: {
								relationships: true,
							},
						},
					},
				});

				if (!user) return null;

				// Map to user response
				const response = user.relationships
					.filter(r => r.following)
					.map(r => r.subject)
					.filter(u =>
						u.relationships.some(
							r => r.following && r.subject.id === self.id
						)
					);

				return {
					id: id,
					accounts: await Promise.all(
						response.map(async u => await u.toAPI())
					),
				};
			})
		)
	).filter(r => r !== null) as {
		id: string;
		accounts: APIAccount[];
	}[];

	return jsonResponse(response);
};
