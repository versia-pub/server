import { sign } from "./crypto.ts";
import { Collection, URICollection } from "./entities/collection.ts";
import type { Entity, Reference } from "./entities/entity.ts";
import { InstanceMetadata } from "./entities/instancemetadata.ts";
import { homepage, version } from "./package.json" with { type: "json" };
import { WebFingerSchema } from "./schemas/webfinger.ts";

const DEFAULT_UA = `VersiaFederationClient/${version} (+${homepage})`;
const CONTENT_TYPE = "application/vnd.versia+json";

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
        private readonly instance: URL,
    ) {}

    public async fetchSigned<T extends typeof Entity>(
        url: URL,
        entityType: T,
    ): Promise<InstanceType<T>> {
        const req = new Request(url, {
            method: "GET",
            headers: {
                Accept: CONTENT_TYPE,
                "User-Agent": DEFAULT_UA,
            },
        });

        const finalReq = await sign(this.privateKey, this.instance, req);

        const res = await fetch(finalReq);

        if (!res.ok) {
            throw new Error(
                `Failed to fetch entity from ${url.toString()}: got HTTP code ${res.status} with body "${await res.text()}"`,
            );
        }

        const contentType = res.headers.get("Content-Type");

        if (
            !(
                contentType?.includes("application/vnd.versia+json") &&
                contentType?.includes("charset=utf-8")
            )
        ) {
            throw new Error(
                `Expected application/vnd.versia+json; charset=utf-8 response from ${url.toString()}, got "${contentType}"`,
            );
        }

        const jsonData = await res.json();
        const type = jsonData.type;

        if (
            (!type || type !== entityType.name) &&
            // (URI)Collections don't have a type field
            ![Collection, URICollection].some((et) => et === entityType)
        ) {
            throw new Error(
                `Expected entity type "${entityType.name}", got "${type}"`,
            );
        }

        const entity = await entityType.fromJSON(jsonData, url.hostname);

        return entity as InstanceType<T>;
    }

    public fetchEntity<T extends typeof Entity>(
        reference: Reference,
        entityType: T,
    ): Promise<InstanceType<T>> {
        const url = new URL(
            `/.versia/v0.6/entities/${encodeURIComponent(
                entityType.name,
            )}/${encodeURIComponent(reference.id)}`,
            `https://${reference.domain}`,
        );

        return this.fetchSigned(url, entityType);
    }

    public async postEntity(domain: string, entity: Entity): Promise<Response> {
        const url = new URL("/.versia/v0.6/inbox", `https://${domain}`);

        const req = new Request(url, {
            method: "POST",
            headers: {
                Accept: CONTENT_TYPE,
                "User-Agent": DEFAULT_UA,
                "Content-Type": "application/vnd.versia+json; charset=utf-8",
            },
            body: JSON.stringify(entity.toJSON()),
        });

        const finalReq = await sign(this.privateKey, this.instance, req);

        return fetch(finalReq);
    }

    /**
     * Recursively go through a Collection of entities until reaching the end
     * @param reference Entity Reference
     * @param entityType
     * @param collectionItemType
     * @param options.limit Limit the number of entities to fetch
     */
    public async resolveCollection<
        E extends typeof Entity,
        T extends typeof Entity,
    >(
        reference: Reference,
        collectionName: string,
        entityType: E,
        collectionItemType: T,
        options?: {
            limit?: number;
        },
    ): Promise<InstanceType<T>[]> {
        const url = new URL(
            `/.versia/v0.6/entities/${encodeURIComponent(
                entityType.name,
            )}/${encodeURIComponent(reference.id)}/collections/${encodeURIComponent(
                collectionName,
            )}`,
            `https://${reference.domain}`,
        );

        const entities: InstanceType<T>[] = [];
        let limit = options?.limit ?? Number.POSITIVE_INFINITY;

        let collection = await this.fetchSigned(url, Collection);
        const total = collection.data.total;

        while (collection && limit > 0) {
            entities.push(
                ...collection.data.items.map(
                    (item) =>
                        collectionItemType.fromJSON(
                            item,
                            reference.domain,
                        ) as InstanceType<T>,
                ),
            );
            limit -= collection.data.items.length;

            if (entities.length >= total) {
                break;
            }

            url.searchParams.set("offset", entities.length.toString());
            collection = await this.fetchSigned(url, Collection);
        }

        return entities;
    }

    /**
     * Recursively go through a URICollection of entities until reaching the end
     * @param reference Entity Reference
     * @param entityType
     * @param options.limit Limit the number of entities to fetch
     */
    public async resolveURICollection<E extends typeof Entity>(
        reference: Reference,
        collectionName: string,
        entityType: E,
        options?: {
            limit?: number;
        },
    ): Promise<string[]> {
        const url = new URL(
            `/.versia/v0.6/entities/${encodeURIComponent(
                entityType.name,
            )}/${encodeURIComponent(reference.id)}/collections/${encodeURIComponent(
                collectionName,
            )}`,
            `https://${reference.domain}`,
        );

        const uris: string[] = [];
        let limit = options?.limit ?? Number.POSITIVE_INFINITY;

        let collection = await this.fetchSigned(url, URICollection);
        const total = collection.data.total;

        while (collection && limit > 0) {
            uris.push(...collection.data.items);
            limit -= collection.data.items.length;

            if (uris.length >= total) {
                break;
            }

            url.searchParams.set("offset", uris.length.toString());
            collection = await this.fetchSigned(url, URICollection);
        }

        return uris;
    }

    /**
     * Attempt to resolve a webfinger URL to a User
     * @returns {Promise<User | null>} The resolved User or null if not found
     */
    public static async resolveWebFinger(
        username: string,
        domain: string,
        contentType = "application/vnd.versia+json",
        serverUrl = `https://${domain}`,
    ): Promise<URL | null> {
        const res = await fetch(
            new URL(
                `/.well-known/webfinger?${new URLSearchParams({
                    resource: `acct:${username}@${domain}`,
                })}`,
                serverUrl,
            ),
            {
                method: "GET",
                headers: {
                    Accept: "application/jrd+json, application/json",
                    "User-Agent": DEFAULT_UA,
                },
            },
        );

        if (!res.ok) {
            throw new Error(
                `Failed to fetch webfinger from ${serverUrl}: got HTTP code ${res.ok} with body "${await res.text()}"`,
            );
        }

        // Validate the response
        const data = await WebFingerSchema.parseAsync(await res.json());

        // Get the first link with a rel of "self"
        const selfLink = data.links?.find(
            (link) => link.rel === "self" && link.type === contentType,
        );

        if (!selfLink?.href) {
            return null;
        }

        return new URL(selfLink.href);
    }

    /**
     * Resolve instance metadata from a domain
     *
     * Fetches well-known for version discovery, and if versia is supported, fetches the instance metadata
     * @param domain
     */
    public async resolveInstance(domain: string): Promise<InstanceMetadata> {
        const wellKnownUrl = new URL(
            "/.well-known/versia",
            `https://${domain}`,
        );

        const wellKnownRes = await fetch(wellKnownUrl, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": DEFAULT_UA,
            },
        });

        if (!wellKnownRes.ok) {
            throw new Error(
                `Failed to fetch well-known from ${wellKnownUrl.toString()}: got HTTP code ${wellKnownRes.status} with body "${await wellKnownRes.text()}"`,
            );
        }

        const wellKnownData = await wellKnownRes.json();

        if (
            !(
                wellKnownData.versions &&
                Array.isArray(wellKnownData.versions) &&
                wellKnownData.versions.includes("0.6.0")
            )
        ) {
            throw new Error(
                `Instance at ${domain} does not support Versia v0.6`,
            );
        }

        const metadataUrl = new URL(
            "/.versia/v0.6/instance",
            `https://${domain}`,
        );

        const metadataRes = await this.fetchSigned(
            metadataUrl,
            InstanceMetadata,
        );

        return metadataRes;
    }
}
