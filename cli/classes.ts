import { parseUserAddress, userAddressValidator } from "@/api";
import { Args, type Command, Flags, type Interfaces } from "@oclif/core";
import { Emoji, Instance, User } from "@versia/kit/db";
import { Emojis, Instances, Users } from "@versia/kit/tables";
import chalk from "chalk";
import { and, eq, inArray, like } from "drizzle-orm";
import { BaseCommand } from "./base.ts";

export type FlagsType<T extends typeof Command> = Interfaces.InferredFlags<
    (typeof BaseCommand)["baseFlags"] & T["flags"]
>;
export type ArgsType<T extends typeof Command> = Interfaces.InferredArgs<
    T["args"]
>;

export abstract class UserFinderCommand<
    T extends typeof BaseCommand,
> extends BaseCommand<typeof UserFinderCommand> {
    public static baseFlags = {
        pattern: Flags.boolean({
            char: "p",
            description:
                "Process as a wildcard pattern (don't forget to escape)",
        }),
        type: Flags.string({
            char: "t",
            description: "Type of identifier",
            options: [
                "id",
                "username",
                "note",
                "display-name",
                "email",
                "address",
            ],
            default: "address",
        }),
        limit: Flags.integer({
            char: "n",
            description: "Limit the number of users",
            default: 100,
        }),
        print: Flags.boolean({
            allowNo: true,
            default: true,
            char: "P",
            description: "Print user(s) found before processing",
        }),
    };

    public static baseArgs = {
        identifier: Args.string({
            description:
                "Identifier of the user (by default this must be an address, i.e. name@host.com)",
            required: true,
        }),
    };

    protected flags!: FlagsType<T>;
    protected args!: ArgsType<T>;

    public async init(): Promise<void> {
        await super.init();
        const { args, flags } = await this.parse({
            flags: this.ctor.flags,
            baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
            args: this.ctor.args,
            strict: this.ctor.strict,
        });
        this.flags = flags as FlagsType<T>;
        this.args = args as ArgsType<T>;
    }

    public async findUsers(): Promise<User[]> {
        // Check if there are asterisks in the identifier but no pattern flag, warn the user if so
        if (this.args.identifier.includes("*") && !this.flags.pattern) {
            this.log(
                chalk.bold(
                    `${chalk.yellow(
                        "⚠",
                    )} Your identifier has asterisks but the --pattern flag is not set. This will match a literal string. If you want to use wildcards, set the --pattern flag.`,
                ),
            );
        }

        const operator = this.flags.pattern ? like : eq;
        // Replace wildcards with an SQL LIKE pattern
        const identifier: string = this.flags.pattern
            ? this.args.identifier.replace(/\*/g, "%")
            : this.args.identifier;

        if (this.flags.type === "address") {
            // Check if the address is valid
            if (!userAddressValidator.exec(identifier)) {
                this.log(
                    "Invalid address. Please check the address format and try again. For example: name@host.com",
                );

                this.exit(1);
            }

            // Check instance exists, if not, create it
            await Instance.resolve(
                new URL(`https://${parseUserAddress(identifier).domain}`),
            );
        }

        return await User.manyFromSql(
            and(
                this.flags.type === "id"
                    ? operator(Users.id, identifier)
                    : undefined,
                this.flags.type === "username"
                    ? operator(Users.username, identifier)
                    : undefined,
                this.flags.type === "note"
                    ? operator(Users.note, identifier)
                    : undefined,
                this.flags.type === "display-name"
                    ? operator(Users.displayName, identifier)
                    : undefined,
                this.flags.type === "email"
                    ? operator(Users.email, identifier)
                    : undefined,
                this.flags.type === "address"
                    ? and(
                          operator(
                              Users.username,
                              parseUserAddress(identifier).username,
                          ),
                          operator(
                              Users.instanceId,
                              (
                                  await Instance.fromSql(
                                      eq(
                                          Instances.baseUrl,
                                          new URL(
                                              `https://${
                                                  parseUserAddress(identifier)
                                                      .domain
                                              }`,
                                          ).host,
                                      ),
                                  )
                              )?.id ?? "",
                          ),
                      )
                    : undefined,
            ),
            undefined,
            this.flags.limit,
        );
    }
}

export abstract class EmojiFinderCommand<
    T extends typeof BaseCommand,
> extends BaseCommand<typeof EmojiFinderCommand> {
    public static baseFlags = {
        pattern: Flags.boolean({
            char: "p",
            description:
                "Process as a wildcard pattern (don't forget to escape)",
        }),
        type: Flags.string({
            char: "t",
            description: "Type of identifier",
            options: ["shortcode", "instance"],
            default: "shortcode",
        }),
        limit: Flags.integer({
            char: "n",
            description: "Limit the number of emojis",
            default: 100,
        }),
        print: Flags.boolean({
            allowNo: true,
            default: true,
            char: "P",
            description: "Print emoji(s) found before processing",
        }),
    };

    public static baseArgs = {
        identifier: Args.string({
            description: "Identifier of the emoji (defaults to shortcode)",
            required: true,
        }),
    };

    protected flags!: FlagsType<T>;
    protected args!: ArgsType<T>;

    public async init(): Promise<void> {
        await super.init();
        const { args, flags } = await this.parse({
            flags: this.ctor.flags,
            baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
            args: this.ctor.args,
            strict: this.ctor.strict,
        });
        this.flags = flags as FlagsType<T>;
        this.args = args as ArgsType<T>;
    }

    public async findEmojis(): Promise<Emoji[]> {
        // Check if there are asterisks in the identifier but no pattern flag, warn the user if so
        if (this.args.identifier.includes("*") && !this.flags.pattern) {
            this.log(
                chalk.bold(
                    `${chalk.yellow(
                        "⚠",
                    )} Your identifier has asterisks but the --pattern flag is not set. This will match a literal string. If you want to use wildcards, set the --pattern flag.`,
                ),
            );
        }

        const operator = this.flags.pattern ? like : eq;
        // Replace wildcards with an SQL LIKE pattern
        const identifier = this.flags.pattern
            ? this.args.identifier.replace(/\*/g, "%")
            : this.args.identifier;

        const instanceIds =
            this.flags.type === "instance"
                ? (
                      await Instance.manyFromSql(
                          operator(Instances.baseUrl, identifier),
                      )
                  ).map((instance) => instance.id)
                : undefined;

        return await Emoji.manyFromSql(
            and(
                this.flags.type === "shortcode"
                    ? operator(Emojis.shortcode, identifier)
                    : undefined,
                instanceIds && instanceIds.length > 0
                    ? inArray(Emojis.instanceId, instanceIds)
                    : undefined,
            ),
            undefined,
            this.flags.limit,
        );
    }
}
