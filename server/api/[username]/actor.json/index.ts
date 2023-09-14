import { errorResponse, jsonLdResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";
import { getHost } from "@config";
import { compact } from "jsonld";

/**
 * ActivityPub user actor endpoinmt
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const username = matchedRoute.params.username.split("@")[0];

	const user = await User.findOneBy({ username });

	if (!user) {
		return errorResponse("User not found", 404);
	}

	return jsonLdResponse(
		await compact({
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
			id: `${getHost()}/@${user.username}/actor`,
			type: "Person",
			preferredUsername: user.username, // TODO: Add user display name
			name: user.username,
			summary: user.bio,
			icon: /*{
				type: "Image",
				url: user.avatar,
				mediaType: mimetype
			}*/ undefined, // TODO: Add avatar
			image: /*{
				type: "Image",
				url: user.avatar,
				mediaType: mimetype
			}*/ undefined, // TODO: Add banner
			inbox: `${getHost()}/@${user.username}/inbox`,
			outbox: `${getHost()}/@${user.username}/outbox`,
			followers: `${getHost()}/@${user.username}/followers`,
			following: `${getHost()}/@${user.username}/following`,
			liked: `${getHost()}/@${user.username}/liked`,
			discoverable: true,
			alsoKnownAs: [
				// TODO: Add accounts from which the user migrated
			],
			manuallyApprovesFollowers: false, // TODO: Change
			publicKey: {
				id: `${getHost()}/@${user.username}/actor#main-key`,
				owner: `${getHost()}/@${user.username}/actor`,
				// TODO: Add user public key
			},
			tag: [
				// TODO: Add emojis here, and hashtags
			],
			attachment: [
				// TODO: Add user attachments (I.E. profile metadata)
			],
			endpoints: {
				sharedInbox: `${getHost()}/inbox`,
			},
		})
	);
};
