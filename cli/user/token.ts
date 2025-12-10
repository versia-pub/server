import { defineCommand } from "@clerc/core";
import { Client, Token } from "@versia-server/kit/db";
import { randomUUIDv7 } from "bun";
import chalk from "chalk";
import { randomString } from "@/math.ts";
import { retrieveUser } from "../utils.ts";

export const generateTokenCommand = defineCommand({
    name: "user token",
    description: "Generates a new access token for a user.",
    parameters: ["<username>"],
    handler: async (context) => {
        const { username } = context.parameters;

        const user = await retrieveUser(username);

        if (!user) {
            throw new Error(`User ${chalk.gray(username)} not found.`);
        }

        const application = await Client.insert({
            id:
                user.id +
                Buffer.from(
                    crypto.getRandomValues(new Uint8Array(32)),
                ).toString("base64"),
            name: "Versia",
            redirectUris: [],
            scopes: ["openid", "profile", "email"],
            secret: "",
        });

        const token = await Token.insert({
            id: randomUUIDv7(),
            accessToken: randomString(64, "base64url"),
            scopes: ["read", "write", "follow"],
            userId: user.id,
            clientId: application.id,
        });

        console.info(
            `Token generated for user ${chalk.gray(user.data.username)}.`,
        );
        console.info(`Access Token: ${chalk.blue(token.data.accessToken)}`);
    },
});
