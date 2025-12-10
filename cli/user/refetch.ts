import { defineCommand } from "@clerc/core";
import { User } from "@versia-server/kit/db";
import chalk from "chalk";
import ora from "ora";
import { retrieveUser } from "../utils.ts";

export const refetchUserCommand = defineCommand({
    name: "user refetch",
    description: "Refetches user data from their remote instance.",
    parameters: ["<handle>"],
    handler: async (context) => {
        const { handle } = context.parameters;

        const user = await retrieveUser(handle);

        if (!user) {
            throw new Error(`User ${chalk.gray(handle)} not found.`);
        }

        if (user.local) {
            throw new Error(
                "This user is local and as such cannot be refetched.",
            );
        }

        const spinner = ora("Refetching user").start();

        try {
            await User.fromVersia(user.uri);
        } catch (error) {
            spinner.fail(
                `Failed to refetch user ${chalk.gray(user.data.username)}`,
            );
            throw error;
        }

        spinner.succeed(`User ${chalk.gray(user.data.username)} refetched.`);
    },
});
