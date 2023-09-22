/* eslint-disable @typescript-eslint/no-unused-vars */
import { getConfig } from "@config";
import { errorResponse, jsonResponse } from "@response";
import {
	APAccept,
	APActivity,
	APActor,
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
import { RawActor } from "~database/entities/RawActor";
import { User } from "~database/entities/User";

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

			if (activity instanceof Response) {
				return activity;
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

			if (object instanceof Response) {
				return object;
			}

			const activity = await RawActivity.addIfNotExists(body, object);

			if (activity instanceof Response) {
				return activity;
			}

			break;
		}
		case "Delete" as APDelete: {
			// Body is an APDelete object
			// Delete the object from database
			// TODO: Add authentication

			const response = await RawActivity.deleteObjectIfExists(
				body.object as APObject
			);

			if (response instanceof Response) {
				return response;
			}

			// Store the Delete event in the database
			const activity = await RawActivity.addIfNotExists(body);

			if (activity instanceof Response) {
				return activity;
			}
			break;
		}
		case "Accept" as APAccept: {
			// Body is an APAccept object
			// Add the actor to the object actor's followers list

			if ((body.object as APFollow).type === "Follow") {
				const user = await User.getByActorId(
					((body.object as APFollow).actor as APActor).id ?? ""
				);

				if (!user) {
					return errorResponse("User not found", 404);
				}

				const actor = await RawActor.addIfNotExists(
					body.actor as APActor
				);

				if (actor instanceof Response) {
					return actor;
				}

				// TODO: Add follower

				await user.save();
			}
			break;
		}
		case "Reject" as APReject: {
			// Body is an APReject object
			// Mark the follow request as not pending

			if ((body.object as APFollow).type === "Follow") {
				const user = await User.getByActorId(
					((body.object as APFollow).actor as APActor).id ?? ""
				);

				if (!user) {
					return errorResponse("User not found", 404);
				}

				const actor = await RawActor.addIfNotExists(
					body.actor as APActor
				);

				if (actor instanceof Response) {
					return actor;
				}

				// TODO: Remove follower

				await user.save();
			}
			break;
		}
		case "Follow" as APFollow: {
			// Body is an APFollow object
			// Add the actor to the object actor's followers list

			const user = await User.getByActorId(
				(body.actor as APActor).id ?? ""
			);

			if (!user) {
				return errorResponse("User not found", 404);
			}

			const actor = await RawActor.addIfNotExists(body.actor as APActor);

			if (actor instanceof Response) {
				return actor;
			}

			// TODO: Add follower

			await user.save();
			break;
		}
	}

	return jsonResponse({});
};
