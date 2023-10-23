/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { FindManyOptions, IsNull, Not } from "typeorm";
import { Status, statusRelations } from "~database/entities/Status";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 200,
		duration: 60,
	},
	route: "/api/v1/timelines/public",
	auth: {
		required: false,
	},
});

/**
 * Fetch public timeline statuses
 */
export default async (req: Request): Promise<Response> => {
	const {
		local,
		limit = 20,
		max_id,
		min_id,
		only_media,
		remote,
		since_id,
	} = await parseRequest<{
		local?: boolean;
		only_media?: boolean;
		remote?: boolean;
		max_id?: string;
		since_id?: string;
		min_id?: string;
		limit?: number;
	}>(req);

	if (limit < 1 || limit > 40) {
		return errorResponse("Limit must be between 1 and 40", 400);
	}

	if (local && remote) {
		return errorResponse("Cannot use both local and remote", 400);
	}

	let query: FindManyOptions<Status> = {
		where: {
			visibility: "public",
		},
		order: {
			created_at: "DESC",
		},
		take: limit,
		relations: statusRelations,
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

	if (only_media) {
		// TODO: add
	}

	if (local) {
		query = {
			...query,
			where: {
				...query.where,
				instance: IsNull(),
			},
		};
	}

	if (remote) {
		query = {
			...query,
			where: {
				...query.where,
				instance: Not(IsNull()),
			},
		};
	}

	const objects = await Status.find(query);

	return jsonResponse(
		await Promise.all(objects.map(async object => await object.toAPI()))
	);
};
