import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { client } from "~database/datasource";
import {
	isViewableByUser,
	statusAndUserRelations,
	statusToAPI,
} from "~database/entities/Status";
import { getFromRequest } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET", "DELETE"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id",
	auth: {
		required: false,
		requiredOnMethods: ["DELETE"],
	},
});

/**
 * Fetch a user
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
	if (!status || isViewableByUser(status, user))
		return errorResponse("Record not found", 404);

	if (req.method === "GET") {
		return jsonResponse(await statusToAPI(status));
	} else if (req.method === "DELETE") {
		if (status.authorId !== user?.id) {
			return errorResponse("Unauthorized", 401);
		}

		// TODO: Implement delete and redraft functionality

		// Get associated Status object

		// Delete status and all associated objects
		await client.status.delete({
			where: { id },
		});

		return jsonResponse(
			{
				...(await statusToAPI(status)),
				// TODO: Add
				// text: Add source text
				// poll: Add source poll
				// media_attachments
			},
			200
		);
	}

	return jsonResponse({});
};
