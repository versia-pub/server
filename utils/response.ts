import type { APActivity, APObject } from "activitypub-types";
import type { NodeObject } from "jsonld";

export const jsonResponse = (
    data: object,
    status = 200,
    headers: Record<string, string> = {},
) => {
    return new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/json",
            "X-Frame-Options": "DENY",
            "X-Permitted-Cross-Domain-Policies": "none",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers":
                "Authorization,Content-Type,Idempotency-Key",
            "Access-Control-Allow-Methods": "POST,PUT,DELETE,GET,PATCH,OPTIONS",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers":
                "Link,X-RateLimit-Reset,X-RateLimit-Limit,X-RateLimit-Remaining,X-Request-Id,Idempotency-Key",
            // CSP should follow  Content Security Policy directive: "connect-src 'self' blob: https: wss:".
            "Content-Security-Policy":
                "default-src 'self'; connect-src 'self' blob: https: wss:; frame-ancestors 'none';",
            ...headers,
        },
        status,
    });
};

export const xmlResponse = (data: string, status = 200) => {
    return new Response(data, {
        headers: {
            "Content-Type": "application/xml",
        },
        status,
    });
};

export const jsonLdResponse = (
    data: NodeObject | APActivity | APObject,
    status = 200,
) => {
    return new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/activity+json",
        },
        status,
    });
};

export const errorResponse = (error: string, status = 500) => {
    return jsonResponse(
        {
            error: error,
        },
        status,
    );
};
