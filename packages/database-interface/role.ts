import { config } from "config-manager";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { db } from "~/drizzle/db";
import { RoleToUsers, Roles } from "~/drizzle/schema";

export class Role {
    private constructor(private role: InferSelectModel<typeof Roles>) {}

    public static fromRole(role: InferSelectModel<typeof Roles>) {
        return new Role(role);
    }

    public static async fromId(id: string | null): Promise<Role | null> {
        if (!id) return null;

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

        if (!found) return null;
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

    public async save(
        role: Partial<InferSelectModel<typeof Roles>> = this.role,
    ) {
        return new Role(
            (
                await db
                    .update(Roles)
                    .set(role)
                    .where(eq(Roles.id, this.id))
                    .returning()
            )[0],
        );
    }

    public async delete() {
        await db.delete(Roles).where(eq(Roles.id, this.id));
    }

    public static async new(role: InferInsertModel<typeof Roles>) {
        return new Role((await db.insert(Roles).values(role).returning())[0]);
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
        return this.role.id;
    }

    public getRole() {
        return this.role;
    }

    public toAPI() {
        return {
            id: this.id,
            name: this.role.name,
            permissions: this.role.permissions,
            priority: this.role.priority,
            description: this.role.description,
            visible: this.role.visible,
            icon: this.role.icon,
        };
    }
}
