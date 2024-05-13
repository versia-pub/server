import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest, wrapRelativeUrl } from "./utils";

const base_url = config.http.base_url;

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
                wrapRelativeUrl(`${base_url}/api/v1/statuses`, base_url),
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
});
