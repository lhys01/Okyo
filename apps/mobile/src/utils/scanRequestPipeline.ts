export type ScanRequestPhase = 'preparing' | 'uploading';

export type ScanRequestPipelineResult<TImage, TResult> =
  | { kind: 'success'; image: TImage; result: TResult }
  | { kind: 'failure'; image?: TImage; error: unknown }
  | { kind: 'stale' };

/** Keeps preparation, durable copying, and upload bound to one active scan. */
export async function runScanRequestPipeline<TPrepared, TImage, TResult>(input: {
  prepare: () => Promise<TPrepared>;
  persist: (prepared: TPrepared) => Promise<TImage>;
  upload: (image: TImage) => Promise<TResult>;
  isCurrent: () => boolean;
  signal: AbortSignal;
  onPhase?: (phase: ScanRequestPhase) => void;
  onImageReady?: (image: TImage) => void;
  onStaleImage?: (image: TImage | undefined) => void;
}): Promise<ScanRequestPipelineResult<TImage, TResult>> {
  let image: TImage | undefined;
  const isActive = () => input.isCurrent() && !input.signal.aborted;

  try {
    input.onPhase?.('preparing');
    const prepared = await input.prepare();
    if (!isActive()) {
      input.onStaleImage?.(image);
      return { kind: 'stale' };
    }

    image = await input.persist(prepared);
    if (!isActive()) {
      input.onStaleImage?.(image);
      return { kind: 'stale' };
    }

    input.onImageReady?.(image);
    input.onPhase?.('uploading');
    const result = await input.upload(image);
    if (!isActive()) {
      input.onStaleImage?.(image);
      return { kind: 'stale' };
    }

    return { kind: 'success', image, result };
  } catch (error) {
    if (!isActive()) {
      input.onStaleImage?.(image);
      return { kind: 'stale' };
    }
    return { kind: 'failure', image, error };
  }
}
