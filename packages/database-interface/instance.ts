import { getLogger } from "@logtape/logtape";
import { EntityValidator, type ValidationError } from "@lysand-org/federation";
import type { ServerMetadata } from "@lysand-org/federation/types";
import chalk from "chalk";
import { config } from "config-manager";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Instances } from "~/drizzle/schema";
import { BaseInterface } from "./base";

export type AttachmentType = InferSelectModel<typeof Instances>;

export class Instance extends BaseInterface<typeof Instances> {
    async reload(): Promise<void> {
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

    async update(
        newInstance: Partial<AttachmentType>,
    ): Promise<AttachmentType> {
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

    save(): Promise<AttachmentType> {
        return this.update(this.data);
    }

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Instances).where(inArray(Instances.id, ids));
        } else {
            await db.delete(Instances).where(eq(Instances.id, this.id));
        }
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

    get id() {
        return this.data.id;
    }

    static async fetchMetadata(url: string): Promise<{
        metadata: ServerMetadata;
        protocol: "lysand" | "activitypub";
    } | null> {
        const origin = new URL(url).origin;
        const wellKnownUrl = new URL("/.well-known/lysand", origin);
        const logger = getLogger("federation");

        try {
            const response = await fetch(wellKnownUrl, {
                proxy: config.http.proxy.address,
            });

            if (!response.ok) {
                // If the server doesn't have a Lysand well-known endpoint, it's not a Lysand instance
                // Try to resolve ActivityPub metadata instead
                const data = await Instance.fetchActivityPubMetadata(url);

                if (!data) {
                    return null;
                }

                return {
                    metadata: data,
                    protocol: "activitypub",
                };
            }

            try {
                const metadata = await new EntityValidator().ServerMetadata(
                    await response.json(),
                );

                return { metadata, protocol: "lysand" };
            } catch (error) {
                logger.error`Instance ${chalk.bold(
                    origin,
                )} has invalid metadata: ${(error as ValidationError).message}`;
                return null;
            }
        } catch (error) {
            logger.error`Failed to fetch Lysand metadata for instance ${chalk.bold(
                origin,
            )} - Error! ${error}`;
            return null;
        }
    }

    private static async fetchActivityPubMetadata(
        url: string,
    ): Promise<ServerMetadata | null> {
        const origin = new URL(url).origin;
        const wellKnownUrl = new URL("/.well-known/nodeinfo", origin);

        // Go to endpoint, then follow the links to the actual metadata

        const logger = getLogger("federation");

        try {
            const response = await fetch(wellKnownUrl, {
                proxy: config.http.proxy.address,
            });

            if (!response.ok) {
                logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                    origin,
                )} - HTTP ${response.status}`;
                return null;
            }

            const wellKnown = await response.json();

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

            const metadataResponse = await fetch(metadataUrl.href, {
                proxy: config.http.proxy.address,
            });

            if (!metadataResponse.ok) {
                logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                    origin,
                )} - HTTP ${metadataResponse.status}`;
                return null;
            }

            const metadata = await metadataResponse.json();

            return {
                name:
                    metadata.metadata.nodeName || metadata.metadata.title || "",
                version: metadata.software.version,
                logo: undefined,
                type: "ServerMetadata",
                supported_extensions: [],
            };
        } catch (error) {
            logger.error`Failed to fetch ActivityPub metadata for instance ${chalk.bold(
                origin,
            )} - Error! ${error}`;
            return null;
        }
    }

    static async resolve(url: string): Promise<Instance> {
        const logger = getLogger("federation");
        const host = new URL(url).host;

        const existingInstance = await Instance.fromSql(
            eq(Instances.baseUrl, host),
        );

        if (existingInstance) {
            return existingInstance;
        }

        const output = await Instance.fetchMetadata(url);

        if (!output) {
            logger.error`Failed to resolve instance ${chalk.bold(host)}`;
            throw new Error("Failed to resolve instance");
        }

        const { metadata, protocol } = output;

        return Instance.insert({
            baseUrl: host,
            name: metadata.name,
            version: metadata.version,
            logo: metadata.logo,
            protocol: protocol,
        });
    }
}
