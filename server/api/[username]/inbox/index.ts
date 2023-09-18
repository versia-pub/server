/* eslint-disable @typescript-eslint/no-unused-vars */
import { getConfig } from "@config";
import { errorResponse, jsonResponse } from "@response";
import {
	APAccept,
	APActivity,
	APCreate,
	APDelete,
	APFollow,
	APObject,
	APReject,
	APTombstone,
	APUpdate,
} from "activitypub-types";
import { MatchedRoute } from "bun";
import { RawActivity } from "~database/entities/RawActivity";

/**
 * ActivityPub user inbox endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	// Check if POST request
	if (req.method !== "POST") {
		return errorResponse("Method not allowed", 405);
	}

	const config = getConfig();

	// Process request body
	const body: APActivity = await req.json();

	// Get the object's ActivityPub type
	const type = body.type;

	switch (type) {
		case "Create" as APCreate: {
			// Body is an APCreate object
			// Store the Create object in database
			// TODO: Add authentication

			// Check is Activity already exists
			const activity = await RawActivity.addIfNotExists(body);

			if (activity instanceof Error) {
				return errorResponse(activity.message, 409);
			}
			break;
		}
		case "Update" as APUpdate: {
			// Body is an APUpdate object
			// Replace the object in database with the new provided object
			// TODO: Add authentication

			const object = await RawActivity.updateObjectIfExists(
				body.object as APObject
			);

			if (object instanceof Error) {
				return errorResponse(object.message, 409);
			}

			const activity = await RawActivity.addIfNotExists(body);

			if (activity instanceof Error) {
				return errorResponse(activity.message, 409);
			}

			break;
		}
		case "Delete" as APDelete: {
			// Body is an APDelete object
			// Delete the object from database
			// TODO: Add authentication

			await RawActivity.deleteObjectIfExists(body.object as APObject);

			// Store the Delete event in the database
			const activity = RawActivity.addIfNotExists(body);
			break;
		}
		case "Accept" as APAccept: {
			// Body is an APAccept object
			// Add the actor to the object actor's followers list
			// TODO: Add actor to object actor's followers list
			break;
		}
		case "Reject" as APReject: {
			// Body is an APReject object
			// Mark the follow request as not pending
			// TODO: Implement
			break;
		}
	}

	return jsonResponse({});
};
