/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { client } from "~database/datasource";
import {
	isViewableByUser,
	statusAndUserRelations,
} from "~database/entities/Status";
import {
	getFromRequest,
	userRelations,
	userToAPI,
} from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/favourited_by",
	auth: {
		required: true,
	},
});

/**
 * Fetch users who favourited the post
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user } = await getFromRequest(req);

	const status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	// Check if user is authorized to view this status (if it's private)
	if (!status || !isViewableByUser(status, user))
		return errorResponse("Record not found", 404);

	const {
		max_id = null,
		min_id = null,
		since_id = null,
		limit = 40,
	} = await parseRequest<{
		max_id?: string;
		min_id?: string;
		since_id?: string;
		limit?: number;
	}>(req);

	// Check for limit limits
	if (limit > 80) return errorResponse("Invalid limit (maximum is 80)", 400);
	if (limit < 1) return errorResponse("Invalid limit", 400);

	const objects = await client.user.findMany({
		where: {
			likes: {
				some: {
					likedId: status.id,
				},
			},
			id: {
				lt: max_id ?? undefined,
				gte: since_id ?? undefined,
				gt: min_id ?? undefined,
			},
		},
		include: {
			...userRelations,
			likes: {
				where: {
					likedId: status.id,
				},
			},
		},
		take: limit,
		orderBy: {
			id: "asc",
		},
	});

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
		objects.map(user => userToAPI(user)),
		200,
		{
			Link: linkHeader.join(", "),
		}
	);
};
