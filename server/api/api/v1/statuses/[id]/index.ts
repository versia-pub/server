import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { RawObject } from "~database/entities/RawObject";
import { Status } from "~database/entities/Status";
import { User } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET", "DELETE"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id",
	auth: {
		required: false,
		requiredOnMethods: ["DELETE"],
	},
});

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user } = await User.getFromRequest(req);

	let foundStatus: RawObject | null;
	try {
		foundStatus = await RawObject.findOneBy({
			id,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundStatus) return errorResponse("Record not found", 404);

	// Check if user is authorized to view this status (if it's private)
	if (
		(await foundStatus.toAPI()).visibility === "private" &&
		(await foundStatus.toAPI()).account.id !== user?.id
	) {
		return errorResponse("Record not found", 404);
	}

	if (req.method === "GET") {
		return jsonResponse(await foundStatus.toAPI());
	} else if (req.method === "DELETE") {
		if ((await foundStatus.toAPI()).account.id !== user?.id) {
			return errorResponse("Unauthorized", 401);
		}

		// TODO: Implement delete and redraft functionality

		// Get associated Status object
		const status = await Status.createQueryBuilder("status")
			.leftJoinAndSelect("status.object", "object")
			.where("object.id = :id", { id: foundStatus.id })
			.getOne();

		if (!status) {
			return errorResponse("Status not found", 404);
		}

		// Delete status and all associated objects
		await status.object.remove();

		return jsonResponse(
			{
				...(await status.toAPI()),
				// TODO: Add
				// text: Add source text
				// poll: Add source poll
				// media_attachments
			},
			200
		);
	}

	return jsonResponse({});
};
