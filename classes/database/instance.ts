import { getLogger } from "@logtape/logtape";
import { EntityValidator, type ResponseError } from "@versia/federation";
import type { InstanceMetadata } from "@versia/federation/types";
import { db } from "@versia/kit/db";
import { Instances } from "@versia/kit/tables";
import { randomUUIDv7 } from "bun";
import chalk from "chalk";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { config } from "~/config.ts";
import { ApiError } from "../errors/api-error.ts";
import { BaseInterface } from "./base.ts";
import { User } from "./user.ts";

type InstanceType = InferSelectModel<typeof Instances>;

export class Instance extends BaseInterface<typeof Instances> {
    public static $type: InstanceType;

    public async reload(): Promise<void> {
        const reloaded = await Instance.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload instance");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Instance | null> {
        if (!id) {
            return null;
        }

        return await Instance.fromSql(eq(Instances.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Instance[]> {
        return await Instance.manyFromSql(inArray(Instances.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Instances.id),
    ): Promise<Instance | null> {
        const found = await db.query.Instances.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Instance(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Instances.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Instances.findMany>[0],
    ): Promise<Instance[]> {
        const found = await db.query.Instances.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Instance(s));
    }

    public async update(
        newInstance: Partial<InstanceType>,
    ): Promise<InstanceType> {
        await db
            .update(Instances)
            .set(newInstance)
            .where(eq(Instances.id, this.id));

        const updated = await Instance.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update instance");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<InstanceType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Instances).where(inArray(Instances.id, ids));
        } else {
            await db.delete(Instances).where(eq(Instances.id, this.id));
        }
    }

    public static async fromUser(user: User): Promise<Instance | null> {
        if (!user.data.instanceId) {
            return null;
        }

        return await Instance.fromId(user.data.instanceId);
    }

    public static async insert(
        data: InferInsertModel<typeof Instances>,
    ): Promise<Instance> {
        const inserted = (
            await db.insert(Instances).values(data).returning()
        )[0];

        const instance = await Instance.fromId(inserted.id);

        if (!instance) {
            throw new Error("Failed to insert instance");
        }

        return instance;
    }

    public get id(): string {
        return this.data.id;
    }

    public static async fetchMetadata(url: URL): Promise<{
        metadata: InstanceMetadata;
        protocol: "versia" | "activitypub";
    }> {
        const origin = new URL(url).origin;
        const wellKnownUrl = new URL("/.well-known/versia", origin);

        const requester = await User.getFederationRequester();

        const { ok, raw, data } = await requester
            .get(wellKnownUrl, {
                // @ts-expect-error Bun extension
                proxy: config.http.proxy_address,
            })
            .catch((e) => ({
                ...(e as ResponseError).response,
            }));

        if (!(ok && raw.headers.get("content-type")?.includes("json"))) {
            // If the server doesn't have a Versia well-known endpoint, it's not a Versia instance
            // Try to resolve ActivityPub metadata instead
            const data = await Instance.fetchActivityPubMetadata(url);

            if (!data) {
                throw new ApiError(
                    404,
                    `Instance at ${origin} is not reachable or does not exist`,
                );
            }

            return {
                metadata: data,
                protocol: "activitypub",
            };
        }

        try {
            const metadata = await new EntityValidator().InstanceMetadata(data);

            return { metadata, protocol: "versia" };
        } catch {
            throw new ApiError(
                404,
                `Instance at ${origin} has invalid metadata`,
            );
        }
    }

    private static async fetchActivityPubMetadata(
        url: URL,
    ): Promise<InstanceMetadata | null> {
        const origin = new URL(url).origin;
        const wellKnownUrl = new URL("/.well-known/nodeinfo", origin);

        // Go to endpoint, then follow the links to the actual metadata

        const logger = getLogger(["federation", "resolvers"]);
        const requester = await User.getFederationRequester();

        try {
            const {
                raw: response,
                ok,
                data: wellKnown,
            } = await requester
                .get<{
                    links: { rel: string; href: string }[];
                }>(wellKnownUrl, {
                    // @ts-expect-error Bun extension
                    proxy: config.http.proxy_address,
                })
                .catch((e) => ({
                    ...(
                        e as ResponseError<{
                            links: { rel: string; href: string }[];
                        }>
                    ).response,
                }));

            if (!ok) {
                logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                    origin,
                )} - HTTP ${response.status}`;
                return null;
            }

            if (!wellKnown.links) {
                logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                    origin,
                )} - No links found`;
                return null;
            }

            const metadataUrl = wellKnown.links.find(
                (link: { rel: string }) =>
                    link.rel ===
                    "http://nodeinfo.diaspora.software/ns/schema/2.0",
            );

            if (!metadataUrl) {
                logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                    origin,
                )} - No metadata URL found`;
                return null;
            }

            const {
                raw: metadataResponse,
                ok: ok2,
                data: metadata,
            } = await requester
                .get<{
                    metadata: {
                        nodeName?: string;
                        title?: string;
                        nodeDescription?: string;
                        description?: string;
                    };
                    software: { version: string };
                }>(metadataUrl.href, {
                    // @ts-expect-error Bun extension
                    proxy: config.http.proxy_address,
                })
                .catch((e) => ({
                    ...(
                        e as ResponseError<{
                            metadata: {
                                nodeName?: string;
                                title?: string;
                                nodeDescription?: string;
                                description?: string;
                            };
                            software: { version: string };
                        }>
                    ).response,
                }));

            if (!ok2) {
                logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                    origin,
                )} - HTTP ${metadataResponse.status}`;
                return null;
            }

            return {
                name:
                    metadata.metadata.nodeName || metadata.metadata.title || "",
                description:
                    metadata.metadata.nodeDescription ||
                    metadata.metadata.description,
                type: "InstanceMetadata",
                software: {
                    name: "Unknown ActivityPub software",
                    version: metadata.software.version,
                },
                created_at: new Date().toISOString(),
                public_key: {
                    key: "",
                    algorithm: "ed25519",
                },
                host: new URL(url).host,
                compatibility: {
                    extensions: [],
                    versions: [],
                },
            };
        } catch (error) {
            logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                origin,
            )} - Error! ${error}`;
            return null;
        }
    }

    public static resolveFromHost(host: string): Promise<Instance> {
        if (host.startsWith("http")) {
            const url = new URL(host);

            return Instance.resolve(url);
        }

        const url = new URL(`https://${host}`);

        return Instance.resolve(url);
    }

    public static async resolve(url: URL): Promise<Instance> {
        const host = url.host;

        const existingInstance = await Instance.fromSql(
            eq(Instances.baseUrl, host),
        );

        if (existingInstance) {
            return existingInstance;
        }

        const output = await Instance.fetchMetadata(url);

        const { metadata, protocol } = output;

        return Instance.insert({
            id: randomUUIDv7(),
            baseUrl: host,
            name: metadata.name,
            version: metadata.software.version,
            logo: metadata.logo,
            protocol,
            publicKey: metadata.public_key,
            inbox: metadata.shared_inbox ?? null,
            extensions: metadata.extensions ?? null,
        });
    }

    public async updateFromRemote(): Promise<Instance> {
        const logger = getLogger(["federation", "resolvers"]);

        const output = await Instance.fetchMetadata(
            new URL(`https://${this.data.baseUrl}`),
        );

        if (!output) {
            logger.error`Failed to update instance ${chalk.bold(this.data.baseUrl)}`;
            throw new Error("Failed to update instance");
        }

        const { metadata, protocol } = output;

        await this.update({
            name: metadata.name,
            version: metadata.software.version,
            logo: metadata.logo,
            protocol,
            publicKey: metadata.public_key,
            inbox: metadata.shared_inbox ?? null,
            extensions: metadata.extensions ?? null,
        });

        return this;
    }

    public async sendMessage(content: string): Promise<void> {
        const logger = getLogger(["federation", "messaging"]);

        if (
            !this.data.extensions?.["pub.versia:instance_messaging"]?.endpoint
        ) {
            logger.info`Instance ${chalk.gray(
                this.data.baseUrl,
            )} does not support Instance Messaging, skipping message`;

            return;
        }

        const endpoint = new URL(
            this.data.extensions["pub.versia:instance_messaging"].endpoint,
        );

        await fetch(endpoint.href, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
            },
            body: content,
        });
    }

    public static getCount(): Promise<number> {
        return db.$count(Instances);
    }
}
