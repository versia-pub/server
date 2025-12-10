import { defineCommand } from "@clerc/core";
import { config } from "@versia-server/config";
import { User } from "@versia-server/kit/db";
import { searchManager } from "@versia-server/kit/search";
import { Users } from "@versia-server/kit/tables";
import chalk from "chalk";
import { and, eq, isNull } from "drizzle-orm";
import { renderUnicodeCompact } from "uqr";

export const createUserCommand = defineCommand({
    name: "user create",
    description: "Create a new user.",
    parameters: ["<username>"],
    flags: {
        password: {
            description: "Password for the new user",
            type: String,
            alias: "p",
        },
        email: {
            description: "Email for the new user",
            type: String,
            alias: "e",
        },
        admin: {
            description: "Make the new user an admin",
            type: Boolean,
            alias: "a",
        },
    },
    handler: async (context) => {
        const { admin, email, password } = context.flags;
        const { username } = context.parameters;

        if (!/^[a-z0-9_-]+$/.test(username)) {
            throw new Error("Username must be alphanumeric and lowercase.");
        }

        // Check if user already exists
        const existingUser = await User.fromSql(
            and(eq(Users.username, username), isNull(Users.instanceId)),
        );

        if (existingUser) {
            throw new Error(`User ${chalk.gray(username)} is taken.`);
        }

        const user = await User.register(username, {
            email,
            password,
            isAdmin: admin,
        });

        // Add to search index
        await searchManager.addUser(user);

        if (!user) {
            throw new Error("Failed to create user.");
        }

        console.info(`User ${chalk.gray(username)} created.`);

        if (!password) {
            const token = await user.resetPassword();

            const link = new URL(
                `${config.frontend.routes.password_reset}?${new URLSearchParams(
                    {
                        token,
                    },
                )}`,
                config.http.base_url,
            );

            console.info(`Password reset link for ${chalk.gray(username)}:`);
            console.info(chalk.blue(link.href));

            const qrcode = renderUnicodeCompact(link.href, {
                border: 2,
            });

            // Pad all lines of QR code with spaces
            console.info(`\n  ${qrcode.replaceAll("\n", "\n  ")}`);
        }
    },
});
