import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { RawObject } from "~database/entities/RawObject";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 200,
		duration: 60,
	},
	route: "/api/v1/timelines/home",
	auth: {
		required: true,
	},
});

/**
 * Fetch home timeline statuses
 */
export default async (req: Request): Promise<Response> => {
	const {
		limit = 20,
		max_id,
		min_id,
		since_id,
	} = await parseRequest<{
		max_id?: string;
		since_id?: string;
		min_id?: string;
		limit?: number;
	}>(req);

	if (limit < 1 || limit > 40) {
		return errorResponse("Limit must be between 1 and 40", 400);
	}

	let query = RawObject.createQueryBuilder("object")
		.where("object.data->>'type' = 'Note'")
		// From a user followed by the current user
		.andWhere("CAST(object.data->>'to' AS jsonb) @> CAST(:to AS jsonb)", {
			to: JSON.stringify([
				"https://www.w3.org/ns/activitystreams#Public",
			]),
		})
		.orderBy("object.data->>'published'", "DESC")
		.take(limit);

	if (max_id) {
		const maxPost = await RawObject.findOneBy({ id: max_id });
		if (maxPost) {
			query = query.andWhere("object.data->>'published' < :max_date", {
				max_date: maxPost.data.published,
			});
		}
	}

	if (min_id) {
		const minPost = await RawObject.findOneBy({ id: min_id });
		if (minPost) {
			query = query.andWhere("object.data->>'published' > :min_date", {
				min_date: minPost.data.published,
			});
		}
	}

	if (since_id) {
		const sincePost = await RawObject.findOneBy({ id: since_id });
		if (sincePost) {
			query = query.andWhere("object.data->>'published' >= :since_date", {
				since_date: sincePost.data.published,
			});
		}
	}

	const objects = await query.getMany();

	return jsonResponse(
		await Promise.all(objects.map(async object => await object.toAPI()))
	);
};