/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import { AppDataSource } from "~database/datasource";
import { Application } from "~database/entities/Application";
import { RawActivity } from "~database/entities/RawActivity";
import { Token, TokenType } from "~database/entities/Token";
import { User } from "~database/entities/User";

const config = getConfig();

let token: Token;
if (!AppDataSource.isInitialized) await AppDataSource.initialize();

// Initialize test user
const user = await User.createNewLocal({
	email: "test@test.com",
	username: "test",
	password: "test",
	display_name: "",
});

const app = new Application();

app.name = "Test Application";
app.website = "https://example.com";
app.client_id = "test";
app.redirect_uris = "https://example.com";
app.scopes = "read write";
app.secret = "test";
app.vapid_key = null;

await app.save();

// Initialize test token
token = new Token();

token.access_token = "test";
token.application = app;
token.code = "test";
token.scope = "read write";
token.token_type = TokenType.BEARER;
token.user = user;

token = await token.save();

await fetch(`${config.http.base_url}/api/v1/statuses`, {
	method: "POST",
	headers: {
		Authorization: `Bearer ${token.access_token}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		status: "Hello, world!",
		visibility: "public",
	}),
});

const timeBefore = performance.now();

// Repeat 100 times
for (let i = 0; i < 100; i++) {
	await fetch(`${config.http.base_url}/api/v1/timelines/public`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token.access_token}`,
		},
	});
}

const timeAfter = performance.now();

const activities = await RawActivity.createQueryBuilder("activity")
	.where("activity.data->>'actor' = :actor", {
		actor: `${config.http.base_url}/@test`,
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

await user.remove();

console.log(`Time taken: ${timeAfter - timeBefore}ms`);
