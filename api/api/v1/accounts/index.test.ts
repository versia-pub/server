import { afterEach, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import { randomString } from "@/math";
import { generateClient, getSolvedChallenge } from "~/tests/utils";

const username = randomString(10, "hex");
const username2 = randomString(10, "hex");

afterEach(async () => {
    await db.delete(Users).where(eq(Users.username, username));
    await db.delete(Users).where(eq(Users.username, username2));
});

// /api/v1/statuses
describe("/api/v1/accounts", () => {
    test("should create a new account", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.registerAccount(
            username,
            "bob@gamer.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok).toBe(true);
        expect(raw.headers.get("Content-Type")).not.toContain("json");
    });

    test("should refuse invalid emails", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.registerAccount(
            username,
            "bob",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should require a password", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.registerAccount(
            username,
            "bob@gamer.com",
            "",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should not allow a previously registered email", async () => {
        await using client = await generateClient();

        const { ok } = await client.registerAccount(
            username,
            "contact@george.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok).toBe(true);

        const { ok: ok2, raw } = await client.registerAccount(
            username2,
            "contact@george.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok2).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should not allow a previously registered email (case insensitive)", async () => {
        await using client = await generateClient();

        const { ok } = await client.registerAccount(
            username,
            "contact@george.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok).toBe(true);

        const { ok: ok2, raw } = await client.registerAccount(
            username2,
            "CONTACT@george.CoM",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok2).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should not allow invalid usernames (not a-z_0-9)", async () => {
        await using client = await generateClient();

        const { ok: ok1, raw: raw1 } = await client.registerAccount(
            "bob$",
            "contact@george.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok1).toBe(false);
        expect(raw1.status).toBe(422);

        const { ok: ok2, raw: raw2 } = await client.registerAccount(
            "bob-markey",
            "contact@bob.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok2).toBe(false);
        expect(raw2.status).toBe(422);

        const { ok: ok3, raw: raw3 } = await client.registerAccount(
            "bob markey",
            "contact@bob.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok3).toBe(false);
        expect(raw3.status).toBe(422);

        const { ok: ok4, raw: raw4 } = await client.registerAccount(
            "BOB",
            "contact@bob.com",
            "password",
            true,
            "en",
            "testing",
            {
                headers: {
                    "X-Challenge-Solution": await getSolvedChallenge(),
                },
            },
        );

        expect(ok4).toBe(false);
        expect(raw4.status).toBe(422);
    });
});
