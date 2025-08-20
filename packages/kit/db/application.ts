import type {
    Application as ApplicationSchema,
    CredentialApplication,
} from "@versia/client/schemas";
import {
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import type { z } from "zod/v4";
import { db } from "../tables/db.ts";
import { Clients } from "../tables/schema.ts";
import { BaseInterface } from "./base.ts";
import { Token } from "./token.ts";

type ClientType = InferSelectModel<typeof Clients>;

export class Client extends BaseInterface<typeof Clients> {
    public static $type: ClientType;

    public async reload(): Promise<void> {
        const reloaded = await Client.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload client");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Client | null> {
        if (!id) {
            return null;
        }

        return await Client.fromSql(eq(Clients.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Client[]> {
        return await Client.manyFromSql(inArray(Clients.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Clients.id),
    ): Promise<Client | null> {
        const found = await db.query.Clients.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Client(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Clients.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Clients.findMany>[0],
    ): Promise<Client[]> {
        const found = await db.query.Clients.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Client(s));
    }

    public static async getFromToken(token: string): Promise<Client | null> {
        const result = await Token.fromAccessToken(token);

        return result?.data.client ? new Client(result.data.client) : null;
    }

    public static fromClientId(clientId: string): Promise<Client | null> {
        return Client.fromSql(eq(Clients.id, clientId));
    }

    public async update(
        newApplication: Partial<ClientType>,
    ): Promise<ClientType> {
        await db
            .update(Clients)
            .set(newApplication)
            .where(eq(Clients.id, this.id));

        const updated = await Client.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update application");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<ClientType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Clients).where(inArray(Clients.id, ids));
        } else {
            await db.delete(Clients).where(eq(Clients.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Clients>,
    ): Promise<Client> {
        const inserted = (await db.insert(Clients).values(data).returning())[0];

        const application = await Client.fromId(inserted.id);

        if (!application) {
            throw new Error("Failed to insert application");
        }

        return application;
    }

    public get id(): string {
        return this.data.id;
    }

    public toApi(): z.infer<typeof ApplicationSchema> {
        return {
            name: this.data.name,
            website: this.data.website,
            scopes: this.data.scopes,
            redirect_uri: this.data.redirectUris.join(" "),
            redirect_uris: this.data.redirectUris,
        };
    }

    public toApiCredential(): z.infer<typeof CredentialApplication> {
        return {
            name: this.data.name,
            website: this.data.website,
            client_id: this.data.id,
            client_secret: this.data.secret,
            client_secret_expires_at: "0",
            scopes: this.data.scopes,
            redirect_uri: this.data.redirectUris.join(" "),
            redirect_uris: this.data.redirectUris,
        };
    }
}
