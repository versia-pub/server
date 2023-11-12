import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import {
	createNewRelationship,
	relationshipToAPI,
} from "~database/entities/Relationship";
import { getFromRequest } from "~database/entities/User";
import { applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/relationships",
	ratelimits: {
		max: 30,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

/**
 * Find relationships
 */
export default async (req: Request): Promise<Response> => {
	const { user: self } = await getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const { "id[]": ids } = await parseRequest<{
		"id[]": string[];
	}>(req);

	// Minimum id count 1, maximum 10
	if (!ids || ids.length < 1 || ids.length > 10) {
		return errorResponse("Number of ids must be between 1 and 10", 422);
	}

	const relationships = await client.relationship.findMany({
		where: {
			ownerId: self.id,
			subjectId: {
				in: ids,
			},
		},
	});

	// Find IDs that dont have a relationship
	const missingIds = ids.filter(
		id => !relationships.some(r => r.subjectId === id)
	);

	// Create the missing relationships
	for (const id of missingIds) {
		const relationship = await createNewRelationship(self, { id } as any);

		relationships.push(relationship);
	}

	// Order in the same order as ids
	relationships.sort(
		(a, b) => ids.indexOf(a.subjectId) - ids.indexOf(b.subjectId)
	);

	return jsonResponse(
		await Promise.all(
			relationships.map(async r => await relationshipToAPI(r))
		)
	);
};
