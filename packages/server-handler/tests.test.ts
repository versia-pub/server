import { afterAll, describe, expect, it, mock } from "bun:test";
import type { MatchedRoute } from "bun";
import { LogManager } from "log-manager";
import { z } from "zod";
import { getTestUsers } from "~tests/utils";
import { type APIRouteExports, processRoute } from ".";

describe("Route Processor", () => {
    it("should return a Response", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response(),
                    meta: {
                        allowedMethods: ["GET"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "GET",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output).toBeInstanceOf(Response);
    });

    it("should return a 404 when the route does not exist", async () => {
        const output = await processRoute(
            {
                filePath: "./nonexistent-route",
            } as MatchedRoute,
            new Request("https://test.com/nonexistent-route"),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(404);
    });

    it("should return a 405 when the request method is not allowed", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response(),
                    meta: {
                        allowedMethods: ["POST"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "GET",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(405);
    });

    it("should return a 401 when the route requires authentication but no user is authenticated", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response(),
                    meta: {
                        allowedMethods: ["POST"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: true,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "POST",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(401);
    });

    it("should return a 400 when the Content-Type header is missing but there is a body", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response(),
                    meta: {
                        allowedMethods: ["POST", "PUT", "PATCH"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "POST",
                body: "test",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(400);
    });

    it("should return a 400 when the request could not be parsed", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response(),
                    meta: {
                        allowedMethods: ["POST"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: "invalid-json",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(400);
    });

    it("should return a 422 when the request does not match the schema", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response(),
                    meta: {
                        allowedMethods: ["POST"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({
                        foo: z.string(),
                    }),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ bar: "baz" }),
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(422);
    });

    it("should convert any JS objects returned by the route to a Response", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => ({ status: 200 }),
                    meta: {
                        allowedMethods: ["GET"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "GET",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(200);
    });

    it("should handle route errors", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => {
                        throw new Error("Route error");
                    },
                    meta: {
                        allowedMethods: ["GET"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "GET",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(500);
    });

    it("should return the route output when everything is valid", async () => {
        mock.module(
            "./route",
            () =>
                ({
                    default: async () => new Response("OK"),
                    meta: {
                        allowedMethods: ["GET"],
                        ratelimits: {
                            max: 100,
                            duration: 60,
                        },
                        route: "/route",
                        auth: {
                            required: false,
                        },
                    },
                    schema: z.object({}),
                }) as APIRouteExports,
        );

        const output = await processRoute(
            {
                filePath: "./route",
            } as MatchedRoute,
            new Request("https://test.com/route", {
                method: "GET",
            }),
            new LogManager(Bun.file("/dev/null")),
        );

        expect(output.status).toBe(200);
        expect(await output.text()).toBe("OK");
    });
});
