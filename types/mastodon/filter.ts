export type Filter = {
    id: string;
    phrase: string;
    context: FilterContext[];
    expires_at: string | null;
    irreversible: boolean;
    whole_word: boolean;
};

export type FilterContext = string;
