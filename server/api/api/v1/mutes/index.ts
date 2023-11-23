import { errorResponse, jsonResponse } from "@response";
import {
	getFromRequest,
	userRelations,
	userToAPI,
} from "~database/entities/User";
import { applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/mutes",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

export default async (req: Request): Promise<Response> => {
	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	const blocks = await client.user.findMany({
		where: {
			relationshipSubjects: {
				every: {
					ownerId: user.id,
					muting: true,
				},
			},
		},
		include: userRelations,
	});

	return jsonResponse(blocks.map(u => userToAPI(u)));
};
