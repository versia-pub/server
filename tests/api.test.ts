import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest, wrapRelativeUrl } from "./utils";

const baseUrl = config.http.base_url;

const { tokens, deleteUsers } = await getTestUsers(1);

describe("API Tests", () => {
    afterAll(async () => {
        await deleteUsers();
    });

    test("Try sending FormData without a boundary", async () => {
        const formData = new FormData();
        formData.append("test", "test");

        const response = await sendTestRequest(
            new Request(
                wrapRelativeUrl(`${baseUrl}/api/v1/statuses`, baseUrl),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                        "Content-Type": "multipart/form-data",
                    },
                    body: formData,
                },
            ),
        );

        expect(response.status).toBe(400);
        const data = await response.json();

        expect(data.error).toBeString();
        expect(data.error).toContain("https://stackoverflow.com");
    });

    // Now automatically mitigated by the server
    /* test("try sending a request with a different origin", async () => {
        if (new URL(config.http.base_url).protocol === "http:") {
            return;
        }

        const response = await sendTestRequest(
            new Request(
                new URL(
                    "/api/v1/instance",
                    base_url.replace("https://", "http://"),
                ),
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain("does not match base URL");
    }); */
});
