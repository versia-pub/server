import type { RolePermissions } from "~/drizzle/schema";

export type LysandRole = {
    id: string;
    name: string;
    permissions: RolePermissions[];
    priority: number;
    description: string | null;
    visible: boolean;
    icon: string | null;
};
