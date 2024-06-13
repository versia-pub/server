import type { InferModelFromColumns, InferSelectModel } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

export abstract class BaseInterface<
    // biome-ignore lint/suspicious/noExplicitAny: This is just an extended interface
    Table extends PgTableWithColumns<any>,
    Columns = InferModelFromColumns<Table["_"]["columns"]>,
> {
    constructor(public data: Columns) {}

    public abstract save(): Promise<Columns>;

    public abstract delete(ids: string[]): Promise<void>;
    public abstract delete(): Promise<void>;

    public abstract update(
        newData: Partial<InferSelectModel<Table>>,
    ): Promise<Columns>;

    public abstract reload(): Promise<void>;
}
