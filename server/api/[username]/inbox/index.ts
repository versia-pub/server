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
import { appendFile } from "fs/promises";
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
			const exists = await RawActivity.createQueryBuilder("activity")
				.where("activity.data->>'id' = :id", {
					id: body.id,
				})
				.getOne();

			if (exists) return errorResponse("Activity already exists", 409);

			// Check if object already exists
			const objectExists = await RawObject.createQueryBuilder("object")
				.where("object.data->>'id' = :id", {
					id: (body.object as APObject).id,
				})
				.getOne();

			if (objectExists)
				return errorResponse("Object already exists", 409);

			// Check if object body contains any filtered terms
			const filter_result = await Promise.all(
				config.filters.note_filters.map(async filter => {
					if (
						(body.object as APObject).type === "Note" &&
						(body.object as APObject).content?.match(filter)
					) {
						// Log filter

						if (config.logging.log_filters)
							await appendFile(
								process.cwd() + "/logs/filters.log",
								`${new Date().toISOString()} Filtered note content: "${(
									body.object as APObject
								).content?.replaceAll("\n", " ")}" (ID: ${
									(body.object as APObject).id
								}) based on rule: ${filter}\n`
							);
						return true;
					}
				})
			);

			if (filter_result.includes(true)) return jsonResponse({});

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
		case "Update" as APUpdate: {
			// Body is an APUpdate object
			// Replace the object in database with the new provided object
			// TODO: Add authentication

			const object = await RawObject.createQueryBuilder("object")
				.where("object.data->>'id' = :id", {
					id: (body.object as APObject).id,
				})
				.getOne();

			if (!object) return errorResponse("Object not found", 404);

			object.data = body.object as APObject;

			// Store the Update event in database
			const activity = new RawActivity();
			activity.data = {
				...body,
				object: undefined,
			};
			activity.objects = [object];

			await object.save();
			await activity.save();
			break;
		}
		case "Delete" as APDelete: {
			// Body is an APDelete object
			// Delete the object from database
			// TODO: Add authentication

			const object = await RawObject.createQueryBuilder("object")
				.where("object.data->>'id' = :id", {
					id: (body.object as APObject).id,
				})
				.getOne();

			if (!object) return errorResponse("Object not found", 404);

			const activities = await RawActivity.createQueryBuilder("activity")
				// Objects is a many-to-many relationship
				.leftJoinAndSelect("activity.objects", "objects")
				.where("objects.data @> :data", {
					data: JSON.stringify({
						id: object.id,
					}),
				})
				.getMany();

			if (config.activitypub.use_tombstones) {
				object.data = {
					...object.data,
					type: "Tombstone",
					deleted: new Date(),
					formerType: object.data.type,
				} as APTombstone;

				await object.save();
			} else {
				activities.forEach(
					activity =>
						(activity.objects = activity.objects.filter(
							o => o.id !== object.id
						))
				);

				await Promise.all(
					activities.map(async activity => await activity.save())
				);

				await object.remove();
			}

			// Store the Delete event in the database
			const activity = new RawActivity();
			activity.data = {
				...body,
				object: undefined,
			};
			activity.objects = config.activitypub.use_tombstones
				? [object]
				: [];

			await activity.save();
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
