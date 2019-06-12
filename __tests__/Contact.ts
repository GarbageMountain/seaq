export interface EmailField {
  label: string;
  email: string;
}

export interface PhoneNumberField {
  label: string;
  number: string;
}

export interface Contact {
  recordID?: number;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  emailAddresses?: EmailField[];
  phoneNumbers?: PhoneNumberField[];
  thumbnailPath?: string;
  active?: boolean;
  cool?: {
    yes: boolean;
    howMuch: number;
    why: string;
  };
}
