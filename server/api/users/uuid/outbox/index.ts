import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { userRelations } from "~database/entities/User";
import { getHost } from "@config";
import { applyConfig } from "@api";
import { Status } from "~database/entities/Status";
import { In } from "typeorm";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 500,
	},
	route: "/users/:uuid/outbox",
});

/**
 * ActivityPub user outbox endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const uuid = matchedRoute.params.uuid;
	const pageNumber = Number(matchedRoute.query.page) || 1;

	const statuses = await Status.find({
		where: {
			account: {
				id: uuid,
			},
			visibility: In(["public", "unlisted"]),
		},
		relations: userRelations,
		take: 20,
		skip: 20 * (pageNumber - 1),
	});

	const totalStatuses = await Status.count({
		where: {
			account: {
				id: uuid,
			},
			visibility: In(["public", "unlisted"]),
		},
		relations: userRelations,
	});

	return jsonResponse({
		first: `${getHost()}/users/${uuid}/outbox?page=1`,
		last: `${getHost()}/users/${uuid}/outbox?page=1`,
		total_items: totalStatuses,
		next:
			statuses.length === 20
				? `${getHost()}/users/${uuid}/outbox?page=${pageNumber + 1}`
				: undefined,
		prev:
			pageNumber > 1
				? `${getHost()}/users/${uuid}/outbox?page=${pageNumber - 1}`
				: undefined,
		items: statuses.map(s => s.toLysand()),
	});
};
