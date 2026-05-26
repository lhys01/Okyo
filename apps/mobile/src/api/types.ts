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

export type CreateScanRequest = {
  source: ScanSource;
  mode?: RecipeMode;
};

export type CreateScanResult = {
  scan: ScanResult;
  recipe?: Recipe;
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  note?: string;
  source: ScanSource;
};
