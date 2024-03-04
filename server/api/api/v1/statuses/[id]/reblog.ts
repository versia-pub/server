/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { getConfig } from "~classes/configmanager";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import type { MatchedRoute } from "bun";
import { client } from "~database/datasource";
import {
	isViewableByUser,
	statusAndUserRelations,
	statusToAPI,
} from "~database/entities/Status";
import {
	getFromRequest,
	type UserWithRelations,
} from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/reblog",
	auth: {
		required: true,
	},
});

/**
 * Reblogs a post
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;
	const config = getConfig();

	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	const { visibility = "public" } = await parseRequest<{
		visibility: "public" | "unlisted" | "private";
	}>(req);

	const status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	// Check if user is authorized to view this status (if it's private)
	if (!status || !isViewableByUser(status, user))
		return errorResponse("Record not found", 404);

	const existingReblog = await client.status.findFirst({
		where: {
			authorId: user.id,
			reblogId: status.id,
		},
	});

	if (existingReblog) {
		return errorResponse("Already reblogged", 422);
	}

	const newReblog = await client.status.create({
		data: {
			authorId: user.id,
			reblogId: status.id,
			isReblog: true,
			uri: `${config.http.base_url}/statuses/FAKE-${crypto.randomUUID()}`,
			visibility,
			sensitive: false,
		},
		include: statusAndUserRelations,
	});

	await client.status.update({
		where: { id: newReblog.id },
		data: {
			uri: `${config.http.base_url}/statuses/${newReblog.id}`,
		},
		include: statusAndUserRelations,
	});

	// Create notification for reblog if reblogged user is on the same instance
	if (
		// @ts-expect-error Prisma relations not showing in types
		(status.reblog?.author as UserWithRelations).instanceId ===
		user.instanceId
	) {
		await client.notification.create({
			data: {
				accountId: user.id,
				// @ts-expect-error Prisma relations not showing in types
				notifiedId: status.reblog.authorId,
				type: "reblog",
				statusId: status.reblogId,
			},
		});
	}

	return jsonResponse(
		await statusToAPI(
			{
				...newReblog,
				uri: `${config.http.base_url}/statuses/${newReblog.id}`,
			},
			user
		)
	);
};
