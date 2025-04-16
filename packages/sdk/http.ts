import { sign } from "./crypto.ts";
import { Collection, URICollection } from "./entities/collection.ts";
import type { Entity } from "./entities/entity.ts";
import { homepage, version } from "./package.json";
import { WebFingerSchema } from "./schemas/webfinger.ts";

const DEFAULT_UA = `VersiaFederationClient/${version} (+${homepage})`;

/**
 * A class that handles fetching Versia entities
 *
 * @example
 * const requester = new FederationRequester(privateKey, authorUrl);
 *
 * const user = await requester.fetchEntity(
 *    new URL("https://example.com/users/1"),
 *    User,
 * );
 *
 * console.log(user); // => User { ... }
 */
export class FederationRequester {
    public constructor(
        private readonly privateKey: CryptoKey,
        private readonly authorUrl: URL,
    ) {}

    public async fetchEntity<T extends typeof Entity>(
        url: URL,
        expectedType: T,
    ): Promise<InstanceType<T>> {
        const req = new Request(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": DEFAULT_UA,
            },
        });

        const finalReq = await sign(this.privateKey, this.authorUrl, req);

        const { ok, json, text, headers, status } = await fetch(finalReq);

        if (!ok) {
            throw new Error(
                `Failed to fetch entity from ${url.toString()}: got HTTP code ${status} with body "${await text()}"`,
            );
        }

        const contentType = headers.get("Content-Type");

        if (!contentType?.includes("application/json")) {
            throw new Error(
                `Expected JSON response from ${url.toString()}, got "${contentType}"`,
            );
        }

        const jsonData = await json();
        const type = jsonData.type;

        if (type && type !== expectedType.name) {
            throw new Error(
                `Expected entity type "${expectedType.name}", got "${type}"`,
            );
        }

        const entity = await expectedType.fromJSON(jsonData);

        return entity as InstanceType<T>;
    }

    public async postEntity(url: URL, entity: Entity): Promise<Response> {
        const req = new Request(url, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "User-Agent": DEFAULT_UA,
                "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify(entity.toJSON()),
        });

        const finalReq = await sign(this.privateKey, this.authorUrl, req);

        return fetch(finalReq);
    }

    /**
     * Recursively go through a Collection of entities until reaching the end
     * @param url URL to reach the Collection
     * @param expectedType
     * @param options.limit Limit the number of entities to fetch
     */
    public async resolveCollection<T extends typeof Entity>(
        url: URL,
        expectedType: T,
        options?: {
            limit?: number;
        },
    ): Promise<InstanceType<T>[]> {
        const entities: InstanceType<T>[] = [];
        let nextUrl: URL | null = url;
        let limit = options?.limit ?? Number.POSITIVE_INFINITY;

        while (nextUrl && limit > 0) {
            const collection: Collection = await this.fetchEntity(
                nextUrl,
                Collection,
            );

            for (const entity of collection.data.items) {
                if (entity.type === expectedType.name) {
                    entities.push(
                        (await expectedType.fromJSON(
                            entity,
                        )) as InstanceType<T>,
                    );
                }
            }

            nextUrl = collection.data.next
                ? new URL(collection.data.next)
                : null;
            limit -= collection.data.items.length;
        }

        return entities;
    }

    /**
     * Recursively go through a URICollection of entities until reaching the end
     * @param url URL to reach the Collection
     * @param options.limit Limit the number of entities to fetch
     */
    public async resolveURICollection(
        url: URL,
        options?: {
            limit?: number;
        },
    ): Promise<URL[]> {
        const entities: string[] = [];
        let nextUrl: URL | null = url;
        let limit = options?.limit ?? Number.POSITIVE_INFINITY;

        while (nextUrl && limit > 0) {
            const collection: URICollection = await this.fetchEntity(
                nextUrl,
                URICollection,
            );

            entities.push(...collection.data.items);
            nextUrl = collection.data.next
                ? new URL(collection.data.next)
                : null;
            limit -= collection.data.items.length;
        }

        return entities.map((u) => new URL(u));
    }

    /**
     * Attempt to resolve a webfinger URL to a User
     * @returns {Promise<User | null>} The resolved User or null if not found
     */
    public static async resolveWebFinger(
        username: string,
        hostname: string,
        contentType = "application/json",
        serverUrl = `https://${hostname}`,
    ): Promise<URL | null> {
        const { ok, json, text } = await fetch(
            new URL(
                `/.well-known/webfinger?${new URLSearchParams({
                    resource: `acct:${username}@${hostname}`,
                })}`,
                serverUrl,
            ),
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "User-Agent": DEFAULT_UA,
                },
            },
        );

        if (!ok) {
            throw new Error(
                `Failed to fetch webfinger from ${serverUrl}: got HTTP code ${ok} with body "${await text()}"`,
            );
        }

        // Validate the response
        const data = await WebFingerSchema.parseAsync(await json());

        // Get the first link with a rel of "self"
        const selfLink = data.links?.find(
            (link) => link.rel === "self" && link.type === contentType,
        );

        if (!selfLink?.href) {
            return null;
        }

        return new URL(selfLink.href);
    }
}
