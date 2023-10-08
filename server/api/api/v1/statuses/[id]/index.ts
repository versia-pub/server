import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { RawObject } from "~database/entities/RawObject";
import { Status } from "~database/entities/Status";
import { User } from "~database/entities/User";

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await User.retrieveFromToken(token);

	// TODO: Add checks for user's permissions to view this status

	let foundStatus: RawObject | null;
	try {
		foundStatus = await RawObject.findOneBy({
			id,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundStatus) return errorResponse("Record not found", 404);

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

		return jsonResponse({}, 200);
	}

	return jsonResponse({});
};
