import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { DBStatus } from "~database/entities/DBStatus";
import { DBUser } from "~database/entities/DBUser";

export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const {
		limit,
		exclude_reblogs,
	}: {
		max_id?: string;
		since_id?: string;
		min_id?: string;
		limit?: number;
		only_media?: boolean;
		exclude_replies?: boolean;
		exclude_reblogs?: boolean;
		pinned?: boolean;
		tagged?: string;
	} = matchedRoute.query;

	const user = await DBUser.findOneBy({
		id,
	});

	if (!user)
		return jsonResponse(
			{
				error: "User not found",
			},
			404
		);

	const statuses = await DBStatus.find({
		where: {
			account: {
				id: user.id,
			},
			isReblog: !exclude_reblogs,
		},
		order: {
			created_at: "DESC",
		},
		take: limit ?? 20,
	});

	return jsonResponse(statuses.map((status) => status.toAPI()));
};
