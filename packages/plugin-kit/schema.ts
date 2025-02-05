import { z } from "@hono/zod-openapi";

export const manifestSchema = z.object({
    // biome-ignore lint/style/useNamingConvention: <explanation>
    $schema: z.string().optional(),
    name: z.string().min(3).max(100),
    version: z
        .string()
        .regex(
            /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/gm,
            "Version must be valid SemVer string",
        ),
    description: z.string().min(1).max(4096),
    authors: z
        .array(
            z.object({
                name: z.string().min(1).max(100),
                email: z.string().email().optional(),
                url: z.string().url().optional(),
            }),
        )
        .optional(),
    repository: z
        .object({
            type: z
                .enum([
                    "git",
                    "svn",
                    "mercurial",
                    "bzr",
                    "darcs",
                    "mtn",
                    "cvs",
                    "fossil",
                    "bazaar",
                    "arch",
                    "tla",
                    "archie",
                    "monotone",
                    "perforce",
                    "sourcevault",
                    "plastic",
                    "clearcase",
                    "accurev",
                    "surroundscm",
                    "bitkeeper",
                    "other",
                ])
                .optional(),
            url: z.string().url().optional(),
        })
        .optional(),
});

export type Manifest = {
    name: string;
    version: string;
    description: string;
    authors?:
        | {
              name: string;
              email?: string | undefined;
              url?: string | undefined;
          }[]
        | undefined;
    repository?:
        | {
              type?:
                  | "git"
                  | "svn"
                  | "mercurial"
                  | "bzr"
                  | "darcs"
                  | "mtn"
                  | "cvs"
                  | "fossil"
                  | "bazaar"
                  | "arch"
                  | "tla"
                  | "archie"
                  | "monotone"
                  | "perforce"
                  | "sourcevault"
                  | "plastic"
                  | "clearcase"
                  | "accurev"
                  | "surroundscm"
                  | "bitkeeper"
                  | "other"
                  | undefined;
              url?: string | undefined;
          }
        | undefined;
};

// This is a type guard to ensure that the schema and the type are in sync
// biome-ignore lint/nursery/useExplicitType: <explanation>
function assert<_T extends never>() {
    // ...
}
type TypeEqualityGuard<A, B> = Exclude<A, B> | Exclude<B, A>;
assert<TypeEqualityGuard<Manifest, z.infer<typeof manifestSchema>>>();
