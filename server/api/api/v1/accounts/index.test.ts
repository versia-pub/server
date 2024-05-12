import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    test,
} from "bun:test";
import { randomBytes } from "node:crypto";
import { config } from "config-manager";
import { eq } from "drizzle-orm";
import { db } from "~drizzle/db";
import { Users } from "~drizzle/schema";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { Account as APIAccount } from "~types/mastodon/account";
import { meta } from "./index";

const username = randomBytes(10).toString("hex");
const username2 = randomBytes(10).toString("hex");

afterEach(async () => {
    await db.delete(Users).where(eq(Users.username, username));
    await db.delete(Users).where(eq(Users.username, username2));
});

// /api/v1/statuses
describe(meta.route, () => {
    test("should create a new account", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    email: "bob@gamer.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response.ok).toBe(true);
    });

    test("should refuse invalid emails", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    email: "bob",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should require a password", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    email: "contatc@bob.com",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should not allow a previously registered email", async () => {
        await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    email: "contact@george.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username2,
                    email: "contact@george.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should not allow a previously registered email (case insensitive)", async () => {
        await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    email: "contact@george.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username2,
                    email: "CONTACT@george.CoM",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should not allow invalid usernames (not a-z_0-9)", async () => {
        const response1 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: "bob$",
                    email: "contact@bob.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response1.status).toBe(422);

        const response2 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: "bob-markey",
                    email: "contact@bob.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response2.status).toBe(422);

        const response3 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: "bob markey",
                    email: "contact@bob.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response3.status).toBe(422);

        const response4 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: "BOB",
                    email: "contact@bob.com",
                    password: "password",
                    agreement: "true",
                    locale: "en",
                    reason: "testing",
                }),
            }),
        );

        expect(response4.status).toBe(422);
    });
});
