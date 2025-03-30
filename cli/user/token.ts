import { randomString } from "@/math.ts";
import { randomUUIDv7 } from "bun";
import chalk from "chalk";
// @ts-expect-error - Root import is required or the Clec type definitions won't work
// biome-ignore lint/correctness/noUnusedImports: Root import is required or the Clec type definitions won't work
import { type Root, defineCommand } from "clerc";
import { Token } from "~/classes/database/token.ts";
import { retrieveUser } from "../utils.ts";

export const generateTokenCommand = defineCommand(
    {
        name: "user token",
        description: "Generates a new access token for a user.",
        parameters: ["<username>"],
    },
    async (context) => {
        const { username } = context.parameters;

        const user = await retrieveUser(username);

        if (!user) {
            throw new Error(`User ${chalk.gray(username)} not found.`);
        }

        const token = await Token.insert({
            id: randomUUIDv7(),
            accessToken: randomString(64, "base64url"),
            code: null,
            scope: "read write follow",
            tokenType: "Bearer",
            userId: user.id,
        });

        console.info(
            `Token generated for user ${chalk.gray(user.data.username)}.`,
        );
        console.info(`Access Token: ${chalk.blue(token.data.accessToken)}`);
    },
);
