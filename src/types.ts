export interface CatalogEntry {
  isSecret: boolean;
  isInfra: boolean;
  isConfig: boolean;
}

export interface ProjectMatrix {
  client: string;
  project: string;
  environments: string[];
  keys: string[];
  data: Record<string, Record<string, string>>;
  entryNames: Record<string, string>; // environment → rbw entry name
  catalog: Record<string, CatalogEntry>; // variable name → metadata
}

export interface MatrixPayload {
  projects: ProjectMatrix[];
  timestamp: string;
  error?: string;
}
