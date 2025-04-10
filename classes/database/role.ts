import type { Role as RoleSchema } from "@versia/client/schemas";
import type { RolePermission } from "@versia/client/schemas";
import { db } from "@versia/kit/db";
import { Roles, RoleToUsers } from "@versia/kit/tables";
import {
    and,
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import type { z } from "zod";
import { config } from "~/config.ts";
import { ProxiableUrl } from "../media/url.ts";
import { BaseInterface } from "./base.ts";

type RoleType = InferSelectModel<typeof Roles>;

export class Role extends BaseInterface<typeof Roles> {
    public static $type: RoleType;
    public static defaultRole = new Role({
        id: "default",
        name: "Default",
        permissions: config.permissions.default,
        priority: 0,
        description: "Default role for all users",
        visible: false,
        icon: null,
    });
    public static adminRole = new Role({
        id: "admin",
        name: "Admin",
        permissions: config.permissions.admin,
        priority: 2 ** 31 - 1,
        description: "Default role for all administrators",
        visible: false,
        icon: null,
    });

    public async reload(): Promise<void> {
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
    ): Promise<Role | null> {
        const found = await db.query.Roles.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Role(found);
    }

    public static async getAll(): Promise<Role[]> {
        return (await Role.manyFromSql(undefined)).concat(
            Role.defaultRole,
            Role.adminRole,
        );
    }

    public static async getUserRoles(
        userId: string,
        isAdmin: boolean,
    ): Promise<Role[]> {
        return (
            await db.query.RoleToUsers.findMany({
                where: (role, { eq }): SQL | undefined =>
                    eq(role.userId, userId),
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
    ): Promise<Role[]> {
        const found = await db.query.Roles.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Role(s));
    }

    public async update(newRole: Partial<RoleType>): Promise<RoleType> {
        await db.update(Roles).set(newRole).where(eq(Roles.id, this.id));

        const updated = await Role.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update role");
        }

        return updated.data;
    }

    public save(): Promise<RoleType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
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

    public async linkUser(userId: string): Promise<void> {
        await db.insert(RoleToUsers).values({
            userId,
            roleId: this.id,
        });
    }

    public async unlinkUser(userId: string): Promise<void> {
        await db
            .delete(RoleToUsers)
            .where(
                and(
                    eq(RoleToUsers.roleId, this.id),
                    eq(RoleToUsers.userId, userId),
                ),
            );
    }

    public get id(): string {
        return this.data.id;
    }

    public toApi(): z.infer<typeof RoleSchema> {
        return {
            id: this.id,
            name: this.data.name,
            permissions: this.data.permissions as unknown as RolePermission[],
            priority: this.data.priority,
            description: this.data.description ?? undefined,
            visible: this.data.visible,
            icon: this.data.icon
                ? new ProxiableUrl(this.data.icon).proxied
                : undefined,
        };
    }
}
