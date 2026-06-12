declare module 'seaq-v1' {
  export function seaq<T>(list: T[], query: string, keys?: string[], fuzzy?: number): T[];
}
