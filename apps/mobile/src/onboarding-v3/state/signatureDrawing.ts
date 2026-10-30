/**
 * Pure model for the onboarding "commitment" signature.
 *
 * State contains only serializable points. It never retains React Native touch
 * events, so rendering and persistence are safe after an event has been released.
 */
export type SignaturePoint = { readonly x: number; readonly y: number };
export type SignatureStroke = readonly SignaturePoint[];
export type SignatureDrawing = { readonly aspect: number; readonly strokes: readonly SignatureStroke[] };
export type SignatureCanvasSize = { readonly width: number; readonly height: number };

/** Gesture deltas remain relative to the initial touch when native targets move. */
export function pointFromSignatureDrag(origin: SignaturePoint | null, dx: number, dy: number, canvas: SignatureCanvasSize): SignaturePoint | null {
  if (!origin || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const point = pointFromTouchEvent({ nativeEvent: {
    locationX: origin.x * canvas.width + dx,
    locationY: origin.y * canvas.width + dy,
  } }, canvas);
  return point ? { x: clamp(point.x, 1), y: clamp(point.y, canvas.height / canvas.width) } : null;
}

type TouchEventLike = { nativeEvent?: { locationX?: unknown; locationY?: unknown } | null } | null | undefined;

export const SIGNATURE_MIN_POINTS = 12;
export const SIGNATURE_MIN_LENGTH = 0.3;
export const SIGNATURE_MIN_EXTENT = 0.18;
export const SIGNATURE_MAX_STROKES = 40;
export const SIGNATURE_MAX_POINTS = 2400;
const MIN_POINT_SPACING = 0.004;
const DEFAULT_ASPECT = 0.42;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const safeAspect = (value: unknown) => finite(value) && value > 0 && value <= 4 ? value : DEFAULT_ASPECT;
const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

function canvasSize(value: number | SignatureCanvasSize): SignatureCanvasSize | null {
  if (typeof value === 'number') return finite(value) && value > 0 ? { width: value, height: value * DEFAULT_ASPECT } : null;
  return value && finite(value.width) && finite(value.height) && value.width > 0 && value.height > 0 ? value : null;
}

/** Returns a plain canvas-local point while the responder event is still live. */
export function pointFromTouchEvent(event: TouchEventLike, canvas: number | SignatureCanvasSize): SignaturePoint | null {
  const nativeEvent = event?.nativeEvent;
  const locationX = nativeEvent?.locationX;
  const locationY = nativeEvent?.locationY;
  const size = canvasSize(canvas);
  if (!size || !finite(locationX) || !finite(locationY)) return null;
  // Both coordinates are measured against the same local canvas origin. Y is
  // intentionally normalized by width because SignatureDrawing stores its
  // height as an aspect ratio; this preserves the exact touch position.
  return { x: locationX / size.width, y: locationY / size.width };
}

export const emptySignature = (aspect: number = DEFAULT_ASPECT): SignatureDrawing => ({ aspect: safeAspect(aspect), strokes: [] });

/** Updates the drawing to the actual measured canvas aspect without keeping stale layout data. */
export function resizeSignatureCanvas(drawing: SignatureDrawing | null | undefined, aspect: number): SignatureDrawing {
  const current = safeDrawing(drawing) ?? emptySignature(aspect);
  const nextAspect = safeAspect(aspect);
  return {
    aspect: nextAspect,
    strokes: current.strokes.map((stroke) => stroke.map((point) => ({ x: clamp(point.x, 1), y: clamp(point.y, nextAspect) }))),
  };
}

function safeDrawing(raw: unknown): SignatureDrawing | null {
  if (!raw || typeof raw !== 'object') return null;
  const { aspect, strokes } = raw as { aspect?: unknown; strokes?: unknown };
  if (!finite(aspect) || aspect <= 0 || aspect > 4 || !Array.isArray(strokes) || strokes.length > SIGNATURE_MAX_STROKES) return null;
  let total = 0;
  const cleaned: SignatureStroke[] = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) return null;
    const points: SignaturePoint[] = [];
    for (const rawPoint of stroke) {
      if (!rawPoint || typeof rawPoint !== 'object') return null;
      const { x, y } = rawPoint as { x?: unknown; y?: unknown };
      if (!finite(x) || !finite(y)) return null;
      points.push({ x: clamp(x, 1), y: clamp(y, aspect) });
    }
    total += points.length;
    if (total > SIGNATURE_MAX_POINTS) return null;
    if (points.length) cleaned.push(points);
  }
  return { aspect, strokes: cleaned };
}

/** Starts a new stroke. Missing points and malformed drawings are harmless no-ops. */
export function beginStroke(drawing: SignatureDrawing | null | undefined, point: SignaturePoint | null | undefined): SignatureDrawing {
  const current = safeDrawing(drawing) ?? emptySignature(drawing?.aspect);
  if (!point || !finite(point.x) || !finite(point.y) || current.strokes.length >= SIGNATURE_MAX_STROKES || countPoints(current) >= SIGNATURE_MAX_POINTS) return current;
  const start = { x: clamp(point.x, 1), y: clamp(point.y, current.aspect) };
  return { ...current, strokes: [...current.strokes, [start]] };
}

/** Appends a plain point to the current stroke, dropping barely moved samples. */
export function extendStroke(drawing: SignatureDrawing | null | undefined, point: SignaturePoint | null | undefined): SignatureDrawing {
  const current = safeDrawing(drawing) ?? emptySignature(drawing?.aspect);
  if (!point || !finite(point.x) || !finite(point.y)) return current;
  const last = current.strokes[current.strokes.length - 1];
  if (!last?.length || countPoints(current) >= SIGNATURE_MAX_POINTS) return current;
  const next = { x: clamp(point.x, 1), y: clamp(point.y, current.aspect) };
  const previous = last[last.length - 1];
  if (Math.hypot(next.x - previous.x, next.y - previous.y) < MIN_POINT_SPACING) return current;
  return { ...current, strokes: [...current.strokes.slice(0, -1), [...last, next]] };
}

export function undoLastStroke(drawing: SignatureDrawing | null | undefined): SignatureDrawing {
  const current = safeDrawing(drawing) ?? emptySignature(drawing?.aspect);
  return { ...current, strokes: current.strokes.slice(0, -1) };
}

export function clearSignature(drawing: SignatureDrawing | null | undefined): SignatureDrawing {
  return { ...(safeDrawing(drawing) ?? emptySignature(drawing?.aspect)), strokes: [] };
}

export function countPoints(drawing: unknown): number {
  return safeDrawing(drawing)?.strokes.reduce((total, stroke) => total + stroke.length, 0) ?? 0;
}

export function signatureLength(drawing: unknown): number {
  const safe = safeDrawing(drawing);
  if (!safe) return 0;
  let length = 0;
  for (const stroke of safe.strokes) for (let index = 1; index < stroke.length; index += 1) length += Math.hypot(stroke[index].x - stroke[index - 1].x, stroke[index].y - stroke[index - 1].y);
  return length;
}

function signatureExtent(drawing: unknown): number {
  const points = safeDrawing(drawing)?.strokes.flat() ?? [];
  if (!points.length) return 0;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** Invalid, incomplete, or missing drawing data always evaluates to false. */
export function isValidSignature(drawing: unknown): boolean {
  return countPoints(drawing) >= SIGNATURE_MIN_POINTS
    && signatureLength(drawing) >= SIGNATURE_MIN_LENGTH
    && signatureExtent(drawing) >= SIGNATURE_MIN_EXTENT;
}

/** Builds smooth SVG path data from safe plain points only. */
export function signaturePathData(drawing: unknown, width: number): string {
  const safe = safeDrawing(drawing);
  if (!safe || !finite(width) || width <= 0) return '';
  const f = (value: number) => (value * width).toFixed(1);
  return safe.strokes.map((stroke) => {
    // A tap starts a candidate stroke but is deliberately invisible until it
    // has movement. It cannot become a valid signature on its own.
    if (stroke.length < 2) return '';
    let path = `M${f(stroke[0].x)} ${f(stroke[0].y)}`;
    for (let index = 1; index < stroke.length - 1; index += 1) {
      const midX = (stroke[index].x + stroke[index + 1].x) / 2;
      const midY = (stroke[index].y + stroke[index + 1].y) / 2;
      path += `Q${f(stroke[index].x)} ${f(stroke[index].y)} ${f(midX)} ${f(midY)}`;
    }
    const end = stroke[stroke.length - 1];
    return `${path}L${f(end.x)} ${f(end.y)}`;
  }).join('');
}

/** Rebuilds a valid signature from storage; malformed and insignificant data are rejected. */
export function normalizeSignature(raw: unknown): SignatureDrawing | null {
  const drawing = safeDrawing(raw);
  return drawing && isValidSignature(drawing) ? drawing : null;
}

/** Thins a drawing so it stays small enough to attach to an account record. */
export function compactSignature(drawing: SignatureDrawing | null | undefined, maxPoints: number): SignatureDrawing {
  const current = safeDrawing(drawing) ?? emptySignature(drawing?.aspect);
  const total = countPoints(current);
  if (!Number.isFinite(maxPoints) || maxPoints < 1 || total <= maxPoints) return current;
  const step = Math.ceil(total / maxPoints);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { aspect: current.aspect, strokes: current.strokes.map((stroke) => stroke.filter((_, index) => index % step === 0 || index === stroke.length - 1).map((point) => ({ x: round(point.x), y: round(point.y) }))) };
}
