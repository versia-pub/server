import { getUserByToken } from "@auth";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { User } from "~database/entities/User";
import { APIAccount } from "~types/entities/account";

/**
 * Find familiar followers (followers of a user that you also follow)
 */
export default async (req: Request): Promise<Response> => {
	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const self = await getUserByToken(token);

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
				const user = await User.findOne({
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
