import { afterAll, describe, expect, test } from "bun:test";
import { Application } from "@versia/kit/db";
import { fakeRequest } from "@versia-server/tests";
import { randomUUIDv7 } from "bun";

const application = await Application.insert({
    id: randomUUIDv7(),
    clientId: "test-client-id",
    redirectUri: "https://example.com/callback",
    scopes: "openid profile email",
    secret: "test-secret",
    name: "Test Application",
});

afterAll(async () => {
    await application.delete();
});

describe("/.well-known/jwks", () => {
    test("should return JWK set with valid inputs", async () => {
        const response = await fakeRequest("/.well-known/jwks", {
            method: "GET",
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.keys).toHaveLength(1);
        expect(body.keys[0].kty).toBe("OKP");
        expect(body.keys[0].use).toBe("sig");
        expect(body.keys[0].alg).toBe("EdDSA");
        expect(body.keys[0].kid).toBe("1");
        expect(body.keys[0].crv).toBe("Ed25519");
        expect(body.keys[0].x).toBeString();
    });
});
