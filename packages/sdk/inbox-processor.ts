import type { Entity } from "./entities/entity.ts";
import type { JSONObject } from "./types.ts";

type EntitySorterHandlers = Map<
    typeof Entity,
    (entity: Entity) => MaybePromise<void>
>;
type MaybePromise<T> = T | Promise<T>;

/**
 * @example
 * const jsonData = { ... };
 * const processor = await new EntitySorter(jsonData)
 *     .on(User, async (user) => {
 *        // Do something with the user
 *     })
 *    .sort();
 */
export class EntitySorter {
    private handlers: EntitySorterHandlers = new Map();

    public constructor(private jsonData: JSONObject) {}

    public on<T extends typeof Entity>(
        entity: T,
        handler: (entity: InstanceType<T>) => MaybePromise<void>,
    ): EntitySorter {
        this.handlers.set(
            entity,
            handler as (entity: Entity) => MaybePromise<void>,
        );
        return this;
    }

    /**
     * Sorts the entity based on the provided JSON data.
     * @param {() => MaybePromise<void>} defaultHandler - A default handler to call if no specific handler is found.
     * @throws {Error} If no handler is found for the entity type
     */
    public async sort(
        defaultHandler?: () => MaybePromise<void>,
    ): Promise<void> {
        const type = this.jsonData.type;
        const entity = this.handlers.keys().find((key) => key.name === type);

        if (entity) {
            await this.handlers.get(entity)?.(
                await entity.fromJSON(this.jsonData),
            );
        } else {
            await defaultHandler?.();
        }
    }
}

export type { JSONObject } from "./types.ts";
