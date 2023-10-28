/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { FindManyOptions } from "typeorm";
import { Status, statusAndUserRelations } from "~database/entities/Status";
import { User } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/reblogged_by",
	auth: {
		required: true,
	},
});

/**
 * Fetch users who reblogged the post
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user } = await User.getFromRequest(req);

	let foundStatus: Status | null;
	try {
		foundStatus = await Status.findOne({
			where: {
				id,
			},
			relations: statusAndUserRelations,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundStatus) return errorResponse("Record not found", 404);

	// Check if user is authorized to view this status (if it's private)
	if (!foundStatus.isViewableByUser(user)) {
		return errorResponse("Record not found", 404);
	}

	const {
		max_id = null,
		since_id = null,
		limit = 40,
	} = await parseRequest<{
		max_id?: string;
		since_id?: string;
		limit?: number;
	}>(req);

	// Check for limit limits
	if (limit > 80) return errorResponse("Invalid limit (maximum is 80)", 400);
	if (limit < 1) return errorResponse("Invalid limit", 400);

	// Get list of boosts for this status
	let query: FindManyOptions<Status> = {
		where: {
			reblog: {
				id,
			},
		},
		relations: statusAndUserRelations,
		take: limit,
		order: {
			id: "DESC",
		},
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

	if (since_id) {
		const sincePost = await Status.findOneBy({ id: since_id });
		if (sincePost) {
			query = {
				...query,
				where: {
					...query.where,
					created_at: {
						...(query.where as any)?.created_at,
						$gt: sincePost.created_at,
					},
				},
			};
		}
	}

	const objects = await Status.find(query);

	// Constuct HTTP Link header (next and prev)
	const linkHeader = [];
	if (objects.length > 0) {
		const urlWithoutQuery = req.url.split("?")[0];
		linkHeader.push(
			`<${urlWithoutQuery}?max_id=${objects[0].id}&limit=${limit}>; rel="next"`
		);
		linkHeader.push(
			`<${urlWithoutQuery}?since_id=${
				objects[objects.length - 1].id
			}&limit=${limit}>; rel="prev"`
		);
	}

	return jsonResponse(
		await Promise.all(objects.map(async object => await object.toAPI())),
		200,
		{
			Link: linkHeader.join(", "),
		}
	);
};
