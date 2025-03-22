import { afterAll, describe, expect, test } from "bun:test";
import { config } from "~/config.ts";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/update_credentials
describe("/api/v1/accounts/update_credentials", () => {
    describe("HTML injection testing", () => {
        test("should not allow HTML injection", async () => {
            await using client = await generateClient(users[0]);

            const { ok, data } = await client.updateCredentials({
                note: "Hi! <script>alert('Hello, world!');</script>",
            });

            expect(ok).toBe(true);
            expect(data.note).toBe(
                "<p>Hi! &lt;script&gt;alert('Hello, world!');&lt;/script&gt;</p>\n",
            );
        });

        test("should rewrite all image and video src to go through proxy", async () => {
            await using client = await generateClient(users[0]);

            const { ok, data } = await client.updateCredentials({
                note: "<img src='https://example.com/image.jpg'> <video src='https://example.com/video.mp4'> Test!",
            });

            expect(ok).toBe(true);
            expect(data.note).toBe(
                // Proxy url is base_url/media/proxy/<base64url encoded url>
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
