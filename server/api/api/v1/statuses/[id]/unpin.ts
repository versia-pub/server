/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import type { MatchedRoute } from "bun";
import { client } from "~database/datasource";
import { statusAndUserRelations, statusToAPI } from "~database/entities/Status";
import { getFromRequest } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/unpin",
	auth: {
		required: true,
	},
});

/**
 * Unpins a post
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	let status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	// Check if status exists
	if (!status) return errorResponse("Record not found", 404);

	// Check if status is user's
	if (status.authorId !== user.id) return errorResponse("Unauthorized", 401);

	await client.user.update({
		where: { id: user.id },
		data: {
			pinnedNotes: {
				disconnect: {
					id: status.id,
				},
			},
		},
	});

	status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	if (!status) return errorResponse("Record not found", 404);

	return jsonResponse(statusToAPI(status, user));
};
