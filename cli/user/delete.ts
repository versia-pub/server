import { defineCommand } from "@clerc/core";
import confirm from "@inquirer/confirm";
import chalk from "chalk";
import { retrieveUser } from "../utils.ts";

export const deleteUserCommand = defineCommand({
    name: "user delete",
    alias: "user rm",
    description: "Delete a user from the database. Can use username or handle.",
    parameters: ["<username_or_handle>"],
    flags: {
        confirm: {
            description: "Ask for confirmation before deleting the user",
            type: Boolean,
            alias: "c",
            default: true,
        },
    },
    handler: async (context) => {
        const { confirm: confirmFlag } = context.flags;
        const { username_or_handle } = context.parameters;

        const user = await retrieveUser(username_or_handle);

        if (!user) {
            throw new Error(
                `User ${chalk.gray(username_or_handle)} not found.`,
            );
        }

        console.info(`About to delete user ${chalk.gray(user.data.username)}!`);
        console.info(`Username: ${chalk.blue(user.data.username)}`);
        console.info(`Display Name: ${chalk.blue(user.data.displayName)}`);
        console.info(`Created At: ${chalk.blue(user.data.createdAt)}`);
        console.info(
            `Instance: ${chalk.blue(user.data.instance?.baseUrl || "Local")}`,
        );

        if (confirmFlag) {
            const choice = await confirm({
                message: `Are you sure you want to delete this user? ${chalk.red(
                    "This is irreversible.",
                )}`,
            });

            if (!choice) {
                throw new Error("Operation aborted.");
            }
        }

        await user.delete();

        console.info(
            `User ${chalk.gray(user.data.username)} has been deleted.`,
        );
    },
});
