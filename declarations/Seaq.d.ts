export declare function seaq<T, K extends keyof T>(list: T[], query: string, keys: K[], fuzzy?: number): T[];
export interface MetaDataItem<T> {
    item: T;
    score: number;
}
export declare function getSortedList<T>(list: MetaDataItem<T>[]): MetaDataItem<T>[];
export declare function getProperty<T>(obj: T, key: string): any;
