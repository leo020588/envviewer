export interface CatalogEntry {
  isSecret: boolean;
  isInfra: boolean;
  isConfig: boolean;
}

export interface CatalogTable {
  headers: string[]; // authored column headers, original case/order
  rows: string[][]; // authored data rows (cells trimmed)
}

export interface ProjectMatrix {
  client: string;
  project: string;
  environments: string[];
  keys: string[];
  data: Record<string, Record<string, string>>;
  entryNames: Record<string, string>; // environment → rbw entry name
  catalog: Record<string, CatalogEntry>; // variable name → metadata
  catalogTable?: CatalogTable; // raw catalog CSV, columns as authored
}

export interface MatrixPayload {
  projects: ProjectMatrix[];
  timestamp: string;
  error?: string;
}
