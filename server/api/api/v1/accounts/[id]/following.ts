/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { errorResponse, jsonResponse } from "@response";
import { userRelations, userToAPI } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 60,
		duration: 60,
	},
	route: "/accounts/:id/following",
	auth: {
		required: false,
	},
});

/**
 * Fetch all statuses for a user
 */
export default apiRoute<{
	max_id?: string;
	since_id?: string;
	min_id?: string;
	limit?: number;
}>(async (req, matchedRoute, extraData) => {
	const id = matchedRoute.params.id;

	// TODO: Add pinned
	const { max_id, min_id, since_id, limit = 20 } = extraData.parsedRequest;

	const user = await client.user.findUnique({
		where: { id },
		include: userRelations,
	});

	if (limit < 1 || limit > 40) return errorResponse("Invalid limit", 400);

	if (!user) return errorResponse("User not found", 404);

	const objects = await client.user.findMany({
		where: {
			relationshipSubjects: {
				some: {
					ownerId: user.id,
					following: true,
				},
			},
			id: {
				lt: max_id,
				gt: min_id,
				gte: since_id,
			},
		},
		include: userRelations,
		take: Number(limit),
		orderBy: {
			id: "desc",
		},
	});

	// Constuct HTTP Link header (next and prev)
	const linkHeader = [];
	if (objects.length > 0) {
		const urlWithoutQuery = req.url.split("?")[0];
		linkHeader.push(
			`<${urlWithoutQuery}?max_id=${objects.at(-1)?.id}>; rel="next"`,
			`<${urlWithoutQuery}?min_id=${objects[0].id}>; rel="prev"`
		);
	}

	return jsonResponse(
		await Promise.all(objects.map(object => userToAPI(object))),
		200,
		{
			Link: linkHeader.join(", "),
		}
	);
});
