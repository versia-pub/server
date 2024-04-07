import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { client } from "~database/datasource";
import { createNewLocalUser } from "~database/entities/User";

describe("cli.ts", () => {
    describe("User creation", () => {
        it("should execute user create command without admin flag", async () => {
            afterAll(async () => {
                await client.user.deleteMany({
                    where: {
                        username: "testuser297",
                        email: "testuser297@gmail.com",
                    },
                });
            });

            // Run command and wait for it to finish
            Bun.spawnSync([
                "bun",
                "run",
                "cli.ts",
                "user",
                "create",
                "testuser297",
                "password123",
                "testuser297@gmail.com",
            ]);

            const createdUser = await client.user.findFirst({
                where: {
                    username: "testuser297",
                    email: "testuser297@gmail.com",
                },
            });

            expect(createdUser).toBeDefined();
        });

        it("should execute user create command with admin flag", async () => {
            afterAll(async () => {
                await client.user.deleteMany({
                    where: {
                        username: "testuser297",
                        email: "testuser297@gmail.com",
                    },
                });
            });

            // Run command and wait for it to finish
            Bun.spawnSync([
                "bun",
                "run",
                "cli.ts",
                "user",
                "create",
                "testuser297",
                "password123",
                "testuser297@gmail.com",
                "--admin",
            ]);

            const createdUser = await client.user.findFirst({
                where: {
                    username: "testuser297",
                    email: "testuser297@gmail.com",
                    isAdmin: true,
                },
            });

            expect(createdUser).toBeDefined();
        });
    });

    it("should execute user delete command", async () => {
        beforeAll(async () => {
            await createNewLocalUser({
                username: "bob124",
                password: "jesus",
                email: "bob124@bob124.com",
            });
        });

        Bun.spawnSync(["bun", "run", "cli", "user", "delete", "bob124"]);

        const userExists = await client.user.findFirst({
            where: {
                username: "bob124",
                email: "bob124@bob124.com",
            },
        });

        expect(!!userExists).toBe(false);
    });
});
