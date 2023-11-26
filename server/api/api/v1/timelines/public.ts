import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { statusAndUserRelations, statusToAPI } from "~database/entities/Status";
import { getFromRequest } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

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

export default async (req: Request): Promise<Response> => {
	const { user } = await getFromRequest(req);
	const {
		local,
		limit = 20,
		max_id,
		min_id,
		// only_media,
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

	const objects = await client.status.findMany({
		where: {
			id: {
				lt: max_id ?? undefined,
				gte: since_id ?? undefined,
				gt: min_id ?? undefined,
			},
			instanceId: remote
				? {
						not: null,
				  }
				: local
				? null
				: undefined,
		},
		include: statusAndUserRelations,
		take: limit,
		orderBy: {
			id: "desc",
		},
	});

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
		await Promise.all(
			objects.map(async status => statusToAPI(status, user || undefined))
		),
		200,
		{
			Link: linkHeader.join(", "),
		}
	);
};
