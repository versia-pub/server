import { afterAll, describe, expect, test } from "bun:test";
import type { Account as APIAccount } from "@versia/client/types";
import { config } from "~/packages/config-manager/index.ts";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { tokens, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/update_credentials
describe("/api/v1/accounts/update_credentials", () => {
    describe("HTML injection testing", () => {
        test("should not allow HTML injection", async () => {
            const response = await fakeRequest(
                "/api/v1/accounts/update_credentials",
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    },
                    body: new URLSearchParams({
                        note: "Hi! <script>alert('Hello, world!');</script>",
                    }),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as APIAccount;

            expect(object.note).toBe(
                "<p>Hi! &lt;script&gt;alert('Hello, world!');&lt;/script&gt;</p>\n",
            );
        });

        test("should rewrite all image and video src to go through proxy", async () => {
            const response = await fakeRequest(
                "/api/v1/accounts/update_credentials",
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    },
                    body: new URLSearchParams({
                        note: "<img src='https://example.com/image.jpg'> <video src='https://example.com/video.mp4'> Test!",
                    }),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as APIAccount;
            // Proxy url is base_url/media/proxy/<base64url encoded url>
            expect(object.note).toBe(
                `<p><img src="${config.http.base_url}media/proxy/${Buffer.from(
                    "https://example.com/image.jpg",
                ).toString("base64url")}"> <video src="${
                    config.http.base_url
                }media/proxy/${Buffer.from(
                    "https://example.com/video.mp4",
                ).toString("base64url")}"> Test!</p>\n`,
            );
        });
    });
});
