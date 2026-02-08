import type {
  LmbJson,
  PlaceObjectAction,
  ColorRgba,
  TransformMatrix,
  Vec2,
  BoundsDef,
} from "../lmb/types";

export interface ValidationError {
  severity: "error" | "warning";
  message: string;
  path?: string;
}

/**
 * Validate that a color ID is within bounds or is -1 (unset).
 */
function validateColorId(
  json: LmbJson,
  colorId: number,
  fieldName: string
): ValidationError | null {
  if (colorId === -1) return null;
  if (colorId < 0 || colorId >= json.resources.colors.length) {
    return {
      severity: "error",
      message: `${fieldName} (${colorId}) is out of range [0, ${json.resources.colors.length - 1}]`,
    };
  }
  return null;
}

/**
 * Validate that a position/transform ID is within bounds based on flags.
 */
function validatePositionId(
  json: LmbJson,
  posId: number,
  flags: number
): ValidationError | null {
  if (posId < 0) return null;
  if (flags === 0xffff) return null;

  if (flags === 0x0000) {
    if (posId >= json.resources.transforms.length) {
      return {
        severity: "error",
        message: `positionId (${posId}) exceeds transforms table length (${json.resources.transforms.length})`,
      };
    }
  } else if (flags === 0x8000) {
    if (posId >= json.resources.positions.length) {
      return {
        severity: "error",
        message: `positionId (${posId}) exceeds positions table length (${json.resources.positions.length})`,
      };
    }
  }
  return null;
}

/**
 * Validate a PlaceObjectAction against the current JSON state.
 */
export function validatePlaceObject(
  json: LmbJson,
  po: PlaceObjectAction
): ValidationError[] {
  const errors: ValidationError[] = [];

  const colorMultErr = validateColorId(json, po.colorMultId, "colorMultId");
  if (colorMultErr) errors.push(colorMultErr);

  const colorAddErr = validateColorId(json, po.colorAddId, "colorAddId");
  if (colorAddErr) errors.push(colorAddErr);

  const posErr = validatePositionId(json, po.positionId, po.positionFlags);
  if (posErr) errors.push(posErr);

  if (po.depth < 0) {
    errors.push({ severity: "error", message: `depth (${po.depth}) cannot be negative` });
  }

  return errors;
}

/**
 * Check for duplicate depths within a single frame's displayList.
 * In Flash semantics, each depth should have at most one active placement.
 */
export function checkDuplicateDepths(
  displayList: PlaceObjectAction[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<number>();
  for (const po of displayList) {
    if (po.placementMode === "PLACE" || po.placementMode === "place") {
      if (seen.has(po.depth)) {
        errors.push({
          severity: "warning",
          message: `Duplicate PLACE at depth ${po.depth} in the same frame`,
        });
      }
      seen.add(po.depth);
    }
  }
  return errors;
}

/**
 * Validate a color value (each channel 0-255 for add, 0-256 for mult).
 */
export function validateColor(color: Partial<ColorRgba>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const ch of ["r", "g", "b", "a"] as const) {
    const v = color[ch];
    if (v !== undefined && (v < 0 || v > 65535 || !Number.isFinite(v))) {
      errors.push({
        severity: "error",
        message: `Color channel '${ch}' value ${v} is out of valid range`,
      });
    }
  }
  return errors;
}

/**
 * Validate a transform matrix (all values must be finite).
 */
export function validateTransform(
  transform: Partial<TransformMatrix>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const key of ["a", "b", "c", "d", "x", "y"] as const) {
    const v = transform[key];
    if (v !== undefined && !Number.isFinite(v)) {
      errors.push({
        severity: "error",
        message: `Transform field '${key}' value ${v} is not finite`,
      });
    }
  }
  return errors;
}

/**
 * Validate a position (Vec2).
 */
export function validatePosition(pos: Partial<Vec2>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const key of ["x", "y"] as const) {
    const v = pos[key];
    if (v !== undefined && !Number.isFinite(v)) {
      errors.push({
        severity: "error",
        message: `Position field '${key}' value ${v} is not finite`,
      });
    }
  }
  return errors;
}

/**
 * Validate bounds.
 */
export function validateBounds(bounds: Partial<BoundsDef>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const key of ["x", "y", "width", "height"] as const) {
    const v = bounds[key];
    if (v !== undefined && !Number.isFinite(v)) {
      errors.push({
        severity: "error",
        message: `Bounds field '${key}' value ${v} is not finite`,
      });
    }
  }
  if (bounds.width !== undefined && bounds.width < 0) {
    errors.push({ severity: "warning", message: `Bounds width is negative (${bounds.width})` });
  }
  if (bounds.height !== undefined && bounds.height < 0) {
    errors.push({ severity: "warning", message: `Bounds height is negative (${bounds.height})` });
  }
  return errors;
}
