import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { FindManyOptions, IsNull, Not } from "typeorm";
import { Status, statusAndUserRelations } from "~database/entities/Status";
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

const updateQuery = async (
	id: string | undefined,
	operator: string,
	query: FindManyOptions<Status>
) => {
	if (!id) return query;
	const post = await Status.findOneBy({ id });
	if (post) {
		query = {
			...query,
			where: {
				...query.where,
				created_at: {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					...(query.where as any)?.created_at,
					[operator]: post.created_at,
				},
			},
		};
	}
	return query;
};

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
		relations: statusAndUserRelations,
	};

	query = await updateQuery(max_id, "$lt", query);
	query = await updateQuery(min_id, "$gt", query);
	query = await updateQuery(since_id, "$gte", query);

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
