import { apiRoute, applyConfig } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { getLogger } from "@logtape/logtape";
import type { Entity } from "@versia/federation/types";
import { Instance, User } from "@versia/kit/db";
import { z } from "zod";
import { InboxProcessor } from "~/classes/inbox/processor";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid/inbox",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
    header: z.object({
        "x-signature": z.string().optional(),
        "x-nonce": z.string().optional(),
        "x-signed-by": z
            .string()
            .url()
            .or(z.string().startsWith("instance "))
            .optional(),
        authorization: z.string().optional(),
    }),
    body: z.any(),
};

const route = createRoute({
    method: "post",
    path: "/users/{uuid}/inbox",
    summary: "Receive federation inbox",
    request: {
        params: schemas.param,
        headers: schemas.header,
        body: {
            content: {
                "application/json": {
                    schema: schemas.body,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Request processed",
        },
        201: {
            description: "Request accepted",
        },
        400: {
            description: "Bad request",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        401: {
            description: "Signature could not be verified",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Cannot view users from remote instances",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        500: {
            description: "Internal server error",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string(),
                        message: z.string(),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const {
            "x-signature": signature,
            "x-nonce": nonce,
            "x-signed-by": signedBy,
            authorization,
        } = context.req.valid("header");

        const logger = getLogger(["federation", "inbox"]);
        const body: Entity = await context.req.valid("json");

        if (authorization) {
            const processor = new InboxProcessor(
                context,
                body,
                null,
                {
                    signature,
                    nonce,
                    authorization,
                },
                logger,
            );

            return await processor.process();
        }

        // If not potentially from bridge, check for required headers
        if (!(signature && nonce && signedBy)) {
            return context.json(
                {
                    error: "Missing required headers: x-signature, x-nonce, or x-signed-by",
                },
                400,
            );
        }

        const sender = await User.resolve(signedBy);

        if (!(sender || signedBy.startsWith("instance "))) {
            return context.json(
                { error: `Couldn't resolve sender URI ${signedBy}` },
                404,
            );
        }

        if (sender?.isLocal()) {
            return context.json(
                {
                    error: "Cannot process federation requests from local users",
                },
                400,
            );
        }

        const remoteInstance = sender
            ? await Instance.fromUser(sender)
            : await Instance.resolveFromHost(signedBy.split(" ")[1]);

        if (!remoteInstance) {
            return context.json(
                { error: "Could not resolve the remote instance." },
                500,
            );
        }

        const processor = new InboxProcessor(
            context,
            body,
            remoteInstance,
            {
                signature,
                nonce,
                authorization,
            },
            logger,
        );

        return await processor.process();
    }),
);
