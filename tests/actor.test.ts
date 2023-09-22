/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import { APActor } from "activitypub-types";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { RawActivity } from "~database/entities/RawActivity";
import { User } from "~database/entities/User";

const config = getConfig();

beforeAll(async () => {
	if (!AppDataSource.isInitialized) await AppDataSource.initialize();

	// Initialize test user
	await User.createNew({
		email: "test@test.com",
		username: "test",
		password: "test",
		display_name: "",
	});
});

describe("POST /@test/actor", () => {
	test("should return a valid ActivityPub Actor when querying an existing user", async () => {
		const response = await fetch(
			`${config.http.base_url}:${config.http.port}/@test/actor`,
			{
				method: "GET",
				headers: {
					Accept: "application/activity+json",
				},
			}
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"application/activity+json"
		);

		const actor: APActor = await response.json();

		expect(actor.type).toBe("Person");
		expect(actor.id).toBe(
			`${config.http.base_url}:${config.http.port}/@test`
		);
		expect(actor.preferredUsername).toBe("test");
		expect(actor.inbox).toBe(
			`${config.http.base_url}:${config.http.port}/@test/inbox`
		);
		expect(actor.outbox).toBe(
			`${config.http.base_url}:${config.http.port}/@test/outbox`
		);
		expect(actor.followers).toBe(
			`${config.http.base_url}:${config.http.port}/@test/followers`
		);
		expect(actor.following).toBe(
			`${config.http.base_url}:${config.http.port}/@test/following`
		);
		expect((actor as any).publicKey).toBeDefined();
		expect((actor as any).publicKey.id).toBeDefined();
		expect((actor as any).publicKey.owner).toBe(
			`${config.http.base_url}:${config.http.port}/@test`
		);
		expect((actor as any).publicKey.publicKeyPem).toBeDefined();
		expect((actor as any).publicKey.publicKeyPem).toMatch(
			/(-----BEGIN PUBLIC KEY-----(\n|\r|\r\n)([0-9a-zA-Z+/=]{64}(\n|\r|\r\n))*([0-9a-zA-Z+/=]{1,63}(\n|\r|\r\n))?-----END PUBLIC KEY-----)|(-----BEGIN PRIVATE KEY-----(\n|\r|\r\n)([0-9a-zA-Z+/=]{64}(\n|\r|\r\n))*([0-9a-zA-Z+/=]{1,63}(\n|\r|\r\n))?-----END PRIVATE KEY-----)/
		);
	});
});

afterAll(async () => {
	// Clean up user
	const user = await User.findOneBy({
		username: "test",
	});

	const activities = await RawActivity.createQueryBuilder("activity")
		.where("activity.data->>'actor' = :actor", {
			actor: `${config.http.base_url}:${config.http.port}/@test`,
		})
		.leftJoinAndSelect("activity.objects", "objects")
		.getMany();

	// Delete all created objects and activities as part of testing
	await Promise.all(
		activities.map(async activity => {
			await Promise.all(
				activity.objects.map(async object => await object.remove())
			);
			await activity.remove();
		})
	);

	if (user) {
		await user.selfDestruct();
		await user.remove();
	}
});
