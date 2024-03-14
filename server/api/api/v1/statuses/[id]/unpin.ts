import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { statusToAPI } from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
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
export default apiRoute(async (req, matchedRoute, extraData) => {
	const id = matchedRoute.params.id;

	const { user } = extraData.auth;

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
});
