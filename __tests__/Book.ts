export interface Book {
  title: string;
  author?:
    | string
    | {
        name?: string;
        firstName?: string;
        lastName?: string;
        tags?: Array<{ value: string }>;
      };
  ISBN?: string | number | { name: string };
  tags?: string[];
}

export interface DetailedBook {
  title: string;
  author?: {
    firstName: string;
    lastName: string;
  };
}
