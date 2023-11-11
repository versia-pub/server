/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Status, statusAndUserRelations } from "~database/entities/Status";
import { UserAction, userRelations } from "~database/entities/User";
import { applyConfig } from "@api";
import { FindManyOptions } from "typeorm";

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

	// TODO: Add pinned
	const {
		max_id,
		min_id,
		since_id,
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
		// TODO: Add with_muted
		pinned?: boolean;
		tagged?: string;
	} = matchedRoute.query;

	const user = await UserAction.findOne({
		where: {
			id,
		},
		relations: userRelations,
	});

	if (!user) return errorResponse("User not found", 404);

	// Get list of boosts for this status
	let query: FindManyOptions<Status> = {
		where: {
			account: {
				id: user.id,
			},
			isReblog: exclude_reblogs ? true : undefined,
		},
		relations: statusAndUserRelations,
		take: limit ?? 20,
		order: {
			id: "DESC",
		},
	};

	if (max_id) {
		const maxStatus = await Status.findOneBy({ id: max_id });
		if (maxStatus) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$lt: maxStatus.created_at,
					},
				},
			};
		}
	}

	if (since_id) {
		const sinceStatus = await Status.findOneBy({ id: since_id });
		if (sinceStatus) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$gt: sinceStatus.created_at,
					},
				},
			};
		}
	}

	if (min_id) {
		const minStatus = await Status.findOneBy({ id: min_id });
		if (minStatus) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$gte: minStatus.created_at,
					},
				},
			};
		}
	}

	const objects = await Status.find(query);

	// Constuct HTTP Link header (next and prev)
	const linkHeader = [];
	if (objects.length > 0) {
		const urlWithoutQuery = req.url.split("?")[0];
		linkHeader.push(
			`<${urlWithoutQuery}?max_id=${objects[0].id}&limit=${limit}>; rel="next"`
		);
		linkHeader.push(
			`<${urlWithoutQuery}?since_id=${
				objects[objects.length - 1].id
			}&limit=${limit}>; rel="prev"`
		);
	}

	return jsonResponse(
		await Promise.all(objects.map(async status => await status.toAPI())),
		200,
		{
			Link: linkHeader.join(", "),
		}
	);
};
