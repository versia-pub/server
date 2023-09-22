import { errorResponse, jsonLdResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";
import { getConfig, getHost } from "@config";

/**
 * ActivityPub user actor endpoinmt
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	// Check for Accept header
	const accept = req.headers.get("Accept");

	if (!accept || !accept.includes("application/activity+json")) {
		return errorResponse("This endpoint requires an Accept header", 406);
	}

	const config = getConfig();

	const username = matchedRoute.params.username.replace("@", "");

	const user = await User.findOneBy({ username });

	if (!user) {
		return errorResponse("User not found", 404);
	}

	return jsonLdResponse({
		"@context": [
			"https://www.w3.org/ns/activitystreams",
			"https://w3id.org/security/v1",
			{
				manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
				toot: "http://joinmastodon.org/ns#",
				featured: {
					"@id": "toot:featured",
					"@type": "@id",
				},
				featuredTags: {
					"@id": "toot:featuredTags",
					"@type": "@id",
				},
				alsoKnownAs: {
					"@id": "as:alsoKnownAs",
					"@type": "@id",
				},
				movedTo: {
					"@id": "as:movedTo",
					"@type": "@id",
				},
				schema: "http://schema.org#",
				PropertyValue: "schema:PropertyValue",
				value: "schema:value",
				discoverable: "toot:discoverable",
				Device: "toot:Device",
				Ed25519Signature: "toot:Ed25519Signature",
				Ed25519Key: "toot:Ed25519Key",
				Curve25519Key: "toot:Curve25519Key",
				EncryptedMessage: "toot:EncryptedMessage",
				publicKeyBase64: "toot:publicKeyBase64",
				deviceId: "toot:deviceId",
				claim: {
					"@type": "@id",
					"@id": "toot:claim",
				},
				fingerprintKey: {
					"@type": "@id",
					"@id": "toot:fingerprintKey",
				},
				identityKey: {
					"@type": "@id",
					"@id": "toot:identityKey",
				},
				devices: {
					"@type": "@id",
					"@id": "toot:devices",
				},
				messageFranking: "toot:messageFranking",
				messageType: "toot:messageType",
				cipherText: "toot:cipherText",
				suspended: "toot:suspended",
				Emoji: "toot:Emoji",
				focalPoint: {
					"@container": "@list",
					"@id": "toot:focalPoint",
				},
				Hashtag: "as:Hashtag",
			},
		],
		id: `${config.http.base_url}/@${user.username}`,
		type: "Person",
		preferredUsername: user.username, // TODO: Add user display name
		name: user.username,
		summary: user.note,
		icon: {
			type: "Image",
			url: user.avatar,
			mediaType: "image/png", // TODO: Set user avatar mimetype
		},
		image: {
			type: "Image",
			url: user.header,
			mediaType: "image/png", // TODO: Set user header mimetype
		},
		inbox: `${config.http.base_url}/@${user.username}/inbox`,
		outbox: `${config.http.base_url}/@${user.username}/outbox`,
		followers: `${config.http.base_url}/@${user.username}/followers`,
		following: `${config.http.base_url}/@${user.username}/following`,
		liked: `${config.http.base_url}/@${user.username}/liked`,
		discoverable: true,
		alsoKnownAs: [
			// TODO: Add accounts from which the user migrated
		],
		manuallyApprovesFollowers: false, // TODO: Change
		publicKey: {
			id: `${getHost()}${config.http.base_url}/@${
				user.username
			}/actor#main-key`,
			owner: `${config.http.base_url}/@${user.username}`,
			// Split the public key into PEM format
			publicKeyPem: `-----BEGIN PUBLIC KEY-----\n${user.public_key
				.match(/.{1,64}/g)
				?.join("\n")}\n-----END PUBLIC KEY-----`,
		},
		tag: [
			// TODO: Add emojis here, and hashtags
		],
		attachment: [
			// TODO: Add user attachments (I.E. profile metadata)
		],
		endpoints: {
			sharedInbox: `${config.http.base_url}/inbox`,
		},
	});
};
