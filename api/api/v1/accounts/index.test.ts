import { afterEach, describe, expect, test } from "bun:test";
import { randomString } from "@/math";
import { db } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import { fakeRequest, getSolvedChallenge } from "~/tests/utils";
import { meta } from "./index.ts";

const username = randomString(10, "hex");
const username2 = randomString(10, "hex");

afterEach(async () => {
    await db.delete(Users).where(eq(Users.username, username));
    await db.delete(Users).where(eq(Users.username, username2));
});

// /api/v1/statuses
describe(meta.route, () => {
    test("should create a new account", async () => {
        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username,
                email: "bob@gamer.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response.ok).toBe(true);
    });

    test("should refuse invalid emails", async () => {
        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username,
                email: "bob",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should require a password", async () => {
        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username,
                email: "contatc@bob.com",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should not allow a previously registered email", async () => {
        await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username,
                email: "contact@george.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username: username2,
                email: "contact@george.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should not allow a previously registered email (case insensitive)", async () => {
        await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username,
                email: "contact@george.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username: username2,
                email: "CONTACT@george.CoM",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should not allow invalid usernames (not a-z_0-9)", async () => {
        const response1 = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username: "bob$",
                email: "contact@bob.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response1.status).toBe(422);

        const response2 = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username: "bob-markey",
                email: "contact@bob.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response2.status).toBe(422);

        const response3 = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username: "bob markey",
                email: "contact@bob.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response3.status).toBe(422);

        const response4 = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Challenge-Solution": await getSolvedChallenge(),
            },
            body: JSON.stringify({
                username: "BOB",
                email: "contact@bob.com",
                password: "password",
                agreement: "true",
                locale: "en",
                reason: "testing",
            }),
        });

        expect(response4.status).toBe(422);
    });
});
