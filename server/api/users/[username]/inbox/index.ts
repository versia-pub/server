/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

	const username = matchedRoute.params.username;

	const config = getConfig();

	try {
		if (
			config.activitypub.reject_activities.includes(
				new URL(req.headers.get("Origin") ?? "").hostname
			)
		) {
			// Discard request
			return jsonResponse({});
		}
	} catch (e) {
		console.error(
			`[-] Error parsing Origin header of incoming Activity from ${req.headers.get(
				"Origin"
			)}`
		);
		console.error(e);
	}

	// Process request body
	const body: APActivity = await req.json();

	// Verify HTTP signature
	const signature = req.headers.get("Signature") ?? "";
	const signatureParams = signature
		.split(",")
		.reduce<Record<string, string>>((params, param) => {
			const [key, value] = param.split("=");
			params[key] = value.replace(/"/g, "");
			return params;
		}, {});

	const signedString = `(request-target): post /users/${username}/inbox\nhost: ${
		config.http.base_url
	}\ndate: ${req.headers.get("Date")}`;
	const signatureBuffer = new TextEncoder().encode(signatureParams.signature);
	const signatureBytes = new Uint8Array(signatureBuffer).buffer;
	const publicKeyBuffer = (body.actor as any).publicKey.publicKeyPem;
	const publicKey = await crypto.subtle.importKey(
		"spki",
		publicKeyBuffer,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"]
	);
	const verified = await crypto.subtle.verify(
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		publicKey,
		signatureBytes,
		new TextEncoder().encode(signedString)
	);

	// Get the object's ActivityPub type
	const type = body.type;

	switch (type) {
		case "Create" as APCreate: {
			// Body is an APCreate object
			// Store the Create object in database
			// TODO: Add authentication

			// Check is Activity already exists
			const activity = await RawActivity.createIfNotExists(body);

			if (activity instanceof Response) {
				return activity;
			}
			break;
		}
		case "Update" as APUpdate: {
			// Body is an APUpdate object
			// Replace the object in database with the new provided object
			// TODO: Add authentication

			try {
				if (
					config.activitypub.discard_updates.includes(
						new URL(req.headers.get("Origin") ?? "").hostname
					)
				) {
					// Discard request
					return jsonResponse({});
				}
			} catch (e) {
				console.error(
					`[-] Error parsing Origin header of incoming Update Activity from ${req.headers.get(
						"Origin"
					)}`
				);
				console.error(e);
			}

			const object = await RawActivity.updateObjectIfExists(
				body.object as APObject
			);

			if (object instanceof Response) {
				return object;
			}

			const activity = await RawActivity.createIfNotExists(body, object);

			if (activity instanceof Response) {
				return activity;
			}

			break;
		}
		case "Delete" as APDelete: {
			// Body is an APDelete object
			// Delete the object from database
			// TODO: Add authentication

			try {
				if (
					config.activitypub.discard_deletes.includes(
						new URL(req.headers.get("Origin") ?? "").hostname
					)
				) {
					// Discard request
					return jsonResponse({});
				}
			} catch (e) {
				console.error(
					`[-] Error parsing Origin header of incoming Delete Activity from ${req.headers.get(
						"Origin"
					)}`
				);
				console.error(e);
			}

			const response = await RawActivity.deleteObjectIfExists(
				body.object as APObject
			);

			if (response instanceof Response) {
				return response;
			}

			// Store the Delete event in the database
			const activity = await RawActivity.createIfNotExists(body);

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

			try {
				if (
					config.activitypub.discard_follows.includes(
						new URL(req.headers.get("Origin") ?? "").hostname
					)
				) {
					// Reject request
					return jsonResponse({});
				}
			} catch (e) {
				console.error(
					`[-] Error parsing Origin header of incoming Delete Activity from ${req.headers.get(
						"Origin"
					)}`
				);
				console.error(e);
			}

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
