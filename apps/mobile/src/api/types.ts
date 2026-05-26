import type { GroceryList, Recipe, RecipeMode, ScanResult, ShareCard } from '../mocks';

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

export type ScanSource = 'camera' | 'photos' | 'mock';

export type ScanImageMetadata = {
  uri?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  source?: ScanSource;
  placeholder?: boolean;
};

export type CreateScanRequest = {
  source: ScanSource;
  mode?: RecipeMode;
  image?: ScanImageMetadata;
};

export type CreateScanResult = {
  scan: ScanResult;
  recipe?: Recipe;
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  image?: ScanImageMetadata;
  note?: string;
  source: ScanSource;
};
