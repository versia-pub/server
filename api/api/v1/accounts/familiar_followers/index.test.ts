import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fakeRequest, getTestUsers } from "~/tests/utils.ts";

const { users, tokens, deleteUsers } = await getTestUsers(5);

beforeAll(async () => {
    // Create followers relationships
    const result1 = await fakeRequest(
        `/api/v1/accounts/${users[1].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        },
    );

    expect(result1.status).toBe(200);

    const result2 = await fakeRequest(
        `/api/v1/accounts/${users[2].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        },
    );

    expect(result2.status).toBe(200);

    const result3 = await fakeRequest(
        `/api/v1/accounts/${users[3].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        },
    );

    expect(result3.status).toBe(200);

    const result4 = await fakeRequest(
        `/api/v1/accounts/${users[2].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
            },
        },
    );

    expect(result4.status).toBe(200);

    const result5 = await fakeRequest(
        `/api/v1/accounts/${users[3].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
            },
        },
    );

    expect(result5.status).toBe(200);

    const result6 = await fakeRequest(
        `/api/v1/accounts/${users[3].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[2].data.accessToken}`,
            },
        },
    );

    expect(result6.status).toBe(200);
});

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts/familiar_followers", () => {
    test("should return 0 familiar followers", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/familiar_followers?id=${users[4].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[4].id);
        expect(data[0].accounts).toBeArrayOfSize(0);
    });

    test("should return 1 familiar follower", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/familiar_followers?id=${users[2].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[2].id);
        expect(data[0].accounts[0].id).toBe(users[1].id);
    });

    test("should return 2 familiar followers", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/familiar_followers?id=${users[3].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[3].id);
        expect(data[0].accounts).toBeArrayOfSize(2);
        expect(data[0].accounts[0].id).toBe(users[2].id);
        expect(data[0].accounts[1].id).toBe(users[1].id);
    });

    test("should work with multiple ids", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/familiar_followers?id[]=${users[2].id}&id[]=${users[3].id}&id[]=${users[4].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.length).toBe(3);
        expect(data[0].id).toBe(users[2].id);
        expect(data[0].accounts[0].id).toBe(users[1].id);
        expect(data[1].id).toBe(users[3].id);
        expect(data[1].accounts[0].id).toBe(users[2].id);
        expect(data[1].accounts[1].id).toBe(users[1].id);
        expect(data[2].id).toBe(users[4].id);
        expect(data[2].accounts).toBeArrayOfSize(0);
    });
});
