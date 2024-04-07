import type { LysandObject } from "@prisma/client";
import type { APIAccount } from "~types/entities/account";
import type { APIField } from "~types/entities/field";
import type { ContentFormat } from "~types/lysand/Object";

declare namespace global {
    namespace PrismaJson {
        type InstanceLogo = ContentFormat[];
        type ObjectData = LysandObject;
        type ObjectExtensions = LysandObject["extensions"];
        interface UserEndpoints {
            inbox: string;
            liked: string;
            outbox: string;
            disliked: string;
            featured: string;
            followers: string;
            following: string;
        }
        interface UserSource {
            note: string;
            fields: APIField[];
            privacy: APIAccount["privacy"];
            language: string;
            sensitive: boolean;
        }
    }
}
