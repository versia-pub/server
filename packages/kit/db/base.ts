import type { InferModelFromColumns, InferSelectModel } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

/**
 * BaseInterface is an abstract class that provides a common interface for all models.
 * It includes methods for saving, deleting, updating, and reloading data.
 *
 * @template Table - The type of the table with columns.
 * @template Columns - The type of the columns inferred from the table.
 */
export abstract class BaseInterface<
    // biome-ignore lint/suspicious/noExplicitAny: This is just an extended interface
    Table extends PgTableWithColumns<any>,
    Columns = InferModelFromColumns<Table["_"]["columns"]>,
> {
    /**
     * Constructs a new instance of the BaseInterface.
     *
     * @param data - The data for the model.
     */
    public constructor(public data: Columns) {}

    /**
     * Saves the current state of the model to the database.
     *
     * @returns A promise that resolves with the saved model.
     */
    public abstract save(): Promise<Columns>;

    /**
     * Deletes the model from the database.
     *
     * @param ids - The ids of the models to delete. If not provided, the current model will be deleted.
     * @returns A promise that resolves when the deletion is complete.
     */
    public abstract delete(ids?: string[]): Promise<void>;

    /**
     * Updates the model with new data.
     *
     * @param newData - The new data for the model.
     * @returns A promise that resolves with the updated model.
     */
    public abstract update(
        newData: Partial<InferSelectModel<Table>>,
    ): Promise<Columns>;

    /**
     * Reloads the model from the database.
     *
     * @returns A promise that resolves when the reloading is complete.
     */
    public abstract reload(): Promise<void>;
}
