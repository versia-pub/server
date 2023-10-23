/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { FindManyOptions } from "typeorm";
import { Status } from "~database/entities/Status";
import { User } from "~database/entities/User";
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

	const { user } = await User.getFromRequest(req);

	if (limit < 1 || limit > 40) {
		return errorResponse("Limit must be between 1 and 40", 400);
	}

	let query: FindManyOptions<Status> = {
		where: {
			visibility: "public",
			account: [
				{
					relationships: {
						id: user?.id,
						followed_by: true,
					},
				},
				{
					id: user?.id,
				},
			],
		},
		order: {
			created_at: "DESC",
		},
		take: limit,
		relations: ["object"],
	};

	if (max_id) {
		const maxPost = await Status.findOneBy({ id: max_id });
		if (maxPost) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$lt: maxPost.created_at,
					},
				},
			};
		}
	}

	if (min_id) {
		const minPost = await Status.findOneBy({ id: min_id });
		if (minPost) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$gt: minPost.created_at,
					},
				},
			};
		}
	}

	if (since_id) {
		const sincePost = await Status.findOneBy({ id: since_id });
		if (sincePost) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$gte: sincePost.created_at,
					},
				},
			};
		}
	}

	const objects = await Status.find(query);

	return jsonResponse(
		await Promise.all(objects.map(async object => await object.toAPI()))
	);
};
