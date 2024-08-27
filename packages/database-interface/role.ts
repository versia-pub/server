import { proxyUrl } from "@/response";
import { RolePermission } from "@versia/client/types";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { RoleToUsers, Roles } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { BaseInterface } from "./base";

export type RoleType = InferSelectModel<typeof Roles>;

export class Role extends BaseInterface<typeof Roles> {
    static schema = z.object({
        id: z.string(),
        name: z.string(),
        permissions: z.array(z.nativeEnum(RolePermission)),
        priority: z.number(),
        description: z.string().nullable(),
        visible: z.boolean(),
        icon: z.string().nullable(),
    });

    async reload(): Promise<void> {
        const reloaded = await Role.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload role");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Role | null> {
        if (!id) {
            return null;
        }

        return await Role.fromSql(eq(Roles.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Role[]> {
        return await Role.manyFromSql(inArray(Roles.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Roles.id),
    ) {
        const found = await db.query.Roles.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Role(found);
    }

    public static async getUserRoles(userId: string, isAdmin: boolean) {
        return (
            await db.query.RoleToUsers.findMany({
                where: (role, { eq }) => eq(role.userId, userId),
                with: {
                    role: true,
                    user: {
                        columns: {
                            isAdmin: true,
                        },
                    },
                },
            })
        )
            .map((r) => new Role(r.role))
            .concat(
                new Role({
                    id: "default",
                    name: "Default",
                    permissions: config.permissions.default,
                    priority: 0,
                    description: "Default role for all users",
                    visible: false,
                    icon: null,
                }),
            )
            .concat(
                isAdmin
                    ? [
                          new Role({
                              id: "admin",
                              name: "Admin",
                              permissions: config.permissions.admin,
                              priority: 2 ** 31 - 1,
                              description:
                                  "Default role for all administrators",
                              visible: false,
                              icon: null,
                          }),
                      ]
                    : [],
            );
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Roles.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Roles.findMany>[0],
    ) {
        const found = await db.query.Roles.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Role(s));
    }

    async update(newRole: Partial<RoleType>): Promise<RoleType> {
        await db.update(Roles).set(newRole).where(eq(Roles.id, this.id));

        const updated = await Role.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update role");
        }

        return updated.data;
    }

    save(): Promise<RoleType> {
        return this.update(this.data);
    }

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Roles).where(inArray(Roles.id, ids));
        } else {
            await db.delete(Roles).where(eq(Roles.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Roles>,
    ): Promise<Role> {
        const inserted = (await db.insert(Roles).values(data).returning())[0];

        const role = await Role.fromId(inserted.id);

        if (!role) {
            throw new Error("Failed to insert role");
        }

        return role;
    }

    public async linkUser(userId: string) {
        await db.insert(RoleToUsers).values({
            userId,
            roleId: this.id,
        });
    }

    public async unlinkUser(userId: string) {
        await db
            .delete(RoleToUsers)
            .where(
                and(
                    eq(RoleToUsers.roleId, this.id),
                    eq(RoleToUsers.userId, userId),
                ),
            );
    }

    get id() {
        return this.data.id;
    }

    public toApi() {
        return {
            id: this.id,
            name: this.data.name,
            permissions: this.data.permissions as unknown as RolePermission[],
            priority: this.data.priority,
            description: this.data.description,
            visible: this.data.visible,
            icon: proxyUrl(this.data.icon),
        };
    }
}
