import type {
    Application as ApplicationSchema,
    CredentialApplication,
} from "@versia/client/schemas";
import { db, Token } from "@versia/kit/db";
import { Applications } from "@versia/kit/tables";
import {
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import type { z } from "zod";
import { BaseInterface } from "./base.ts";

type ApplicationType = InferSelectModel<typeof Applications>;

export class Application extends BaseInterface<typeof Applications> {
    public static $type: ApplicationType;

    public async reload(): Promise<void> {
        const reloaded = await Application.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload application");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Application | null> {
        if (!id) {
            return null;
        }

        return await Application.fromSql(eq(Applications.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Application[]> {
        return await Application.manyFromSql(inArray(Applications.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Applications.id),
    ): Promise<Application | null> {
        const found = await db.query.Applications.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Application(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Applications.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Applications.findMany>[0],
    ): Promise<Application[]> {
        const found = await db.query.Applications.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Application(s));
    }

    public static async getFromToken(
        token: string,
    ): Promise<Application | null> {
        const result = await Token.fromAccessToken(token);

        return result?.data.application
            ? new Application(result.data.application)
            : null;
    }

    public static fromClientId(clientId: string): Promise<Application | null> {
        return Application.fromSql(eq(Applications.clientId, clientId));
    }

    public async update(
        newApplication: Partial<ApplicationType>,
    ): Promise<ApplicationType> {
        await db
            .update(Applications)
            .set(newApplication)
            .where(eq(Applications.id, this.id));

        const updated = await Application.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update application");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<ApplicationType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Applications).where(inArray(Applications.id, ids));
        } else {
            await db.delete(Applications).where(eq(Applications.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Applications>,
    ): Promise<Application> {
        const inserted = (
            await db.insert(Applications).values(data).returning()
        )[0];

        const application = await Application.fromId(inserted.id);

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
            scopes: this.data.scopes.split(" "),
            redirect_uri: this.data.redirectUri,
            redirect_uris: this.data.redirectUri.split("\n"),
        };
    }

    public toApiCredential(): z.infer<typeof CredentialApplication> {
        return {
            name: this.data.name,
            website: this.data.website,
            client_id: this.data.clientId,
            client_secret: this.data.secret,
            client_secret_expires_at: "0",
            scopes: this.data.scopes.split(" "),
            redirect_uri: this.data.redirectUri,
            redirect_uris: this.data.redirectUri.split("\n"),
        };
    }
}
