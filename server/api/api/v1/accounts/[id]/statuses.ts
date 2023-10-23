import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Status, statusAndUserRelations } from "~database/entities/Status";
import { User, userRelations } from "~database/entities/User";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id/statuses",
	auth: {
		required: false,
	},
});

/**
 * Fetch all statuses for a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const {
		limit,
		exclude_reblogs,
		pinned,
	}: {
		max_id?: string;
		since_id?: string;
		min_id?: string;
		limit?: number;
		only_media?: boolean;
		exclude_replies?: boolean;
		exclude_reblogs?: boolean;
		// TODO: Add with_muted
		pinned?: boolean;
		tagged?: string;
	} = matchedRoute.query;

	const user = await User.findOne({
		where: {
			id,
		},
		relations: userRelations,
	});

	if (!user) return errorResponse("User not found", 404);

	if (pinned) {
		// TODO: Add pinned statuses
	}

	// TODO: Check if status can be seen by this user
	const statuses = await Status.find({
		where: {
			account: {
				id: user.id,
			},
			isReblog: exclude_reblogs ? true : undefined,
		},
		relations: statusAndUserRelations,
		order: {
			created_at: "DESC",
		},
		take: limit ?? 20,
	});

	return jsonResponse(
		await Promise.all(statuses.map(async status => await status.toAPI()))
	);
};
