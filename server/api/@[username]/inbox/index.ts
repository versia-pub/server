/* eslint-disable @typescript-eslint/no-unused-vars */
import { errorResponse, jsonResponse } from "@response";
import { APActivity, APCreate, APObject } from "activitypub-types";
import { MatchedRoute } from "bun";
import { RawActivity } from "~database/entities/RawActivity";
import { RawObject } from "~database/entities/RawObject";

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

	// Process request body
	const body: APActivity = await req.json();

	// Get the object's ActivityPub type
	const type = body.type;

	switch (type) {
		case "Create" as APCreate: {
			// Body is an APCreate object
			// Store the Create object in database

			// Check is Activity already exists
			const exists = await RawActivity.findOneBy({
				data: {
					id: body.id,
				},
			});

			if (exists) return errorResponse("Activity already exists", 409);

			// Check if object already exists
			const objectExists = await RawObject.findOneBy({
				data: {
					id: (body.object as APObject).id,
				},
			});

			if (objectExists)
				return errorResponse("Object already exists", 409);

			const activity = new RawActivity();
			const object = new RawObject();

			activity.data = {
				...body,
				object: undefined,
			};
			object.data = body.object as APObject;

			activity.objects = [object];

			// Save the new object and activity
			await object.save();
			await activity.save();
			break;
		}
	}

	return jsonResponse({});
};
