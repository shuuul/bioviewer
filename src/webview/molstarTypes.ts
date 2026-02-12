export interface MolstarViewer {
  loadPdb: (accession: string) => Promise<void>;
  loadAlphaFoldDb: (accession: string) => Promise<void>;
  loadEmdb: (accession: string) => Promise<void>;
  loadStructureFromUrl: (
    url: string,
    format: string,
    isBinary?: boolean,
    params?: Record<string, unknown>
  ) => Promise<void>;
  loadVolumeFromUrl?: (params: unknown, isosurfaces: unknown[]) => Promise<void>;
  plugin?: {
    managers?: {
      volume?: {
        hierarchy?: {
          current?: {
            volumes?: Array<{
              cell?: {
                obj?: {
                  label?: string;
                };
              };
            }>;
          };
        };
      };
    };
  };
}

export interface MolstarGlobal {
  setDebugMode?: (isDebugMode: boolean, isProductionMode: boolean) => void;
  Viewer: {
    create: (target: string, options: Record<string, unknown>) => Promise<MolstarViewer>;
  };
}

declare global {
  interface Window {
    molstar?: MolstarGlobal;
  }
}
