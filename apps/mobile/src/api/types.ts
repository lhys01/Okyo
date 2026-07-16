import type { GroceryList, Recipe, RecipeMode, ScanResult, ScanState, ShareCard } from '../mocks';

export type OkyoModelOverride = 'fable';

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

export type AiSource = 'openrouter_ai' | 'mock_ai' | 'fallback_ai';
export type ScanStatus = 'success' | 'partial' | 'rejected' | 'failed';
export type ScanRejectionType = 'not_food' | 'unclear_image' | 'ai_failed';

export type AiDebugMetadata = {
  aiSource: AiSource;
  aiProvider?: string;
  visionModel?: string;
  recipeModel?: string;
  fallbackReason?: string;
  confidence?: number;
};

export type ScanImageMetadata = {
  uri?: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  dataUrlSizeBytes?: number;
  source?: ScanSource;
  placeholder?: boolean;
  conversionError?: string;
};

export type CreateScanRequest = {
  requestId: string;
  source: ScanSource;
  mode?: RecipeMode;
  image?: ScanImageMetadata;
};

export type CreateScanResult = {
  status?: ScanStatus;
  scan?: ScanResult;
  scanId?: string;
  recipe?: Recipe;
  recipes?: Recipe[];
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  image?: ScanImageMetadata;
  note?: string;
  rejectionType?: ScanRejectionType;
  rejectionReason?: string;
  partialReason?: string;
  scanState?: ScanState;
  uploadedImage?: boolean;
  source: ScanSource;
} & Partial<AiDebugMetadata>;
