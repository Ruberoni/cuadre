import { UNITS_OF_MEASURE, type UnitOfMeasure } from "@cuadre/contracts";
import { err, ok, type Result } from "@cuadre/shared-kernel";

export type { UnitOfMeasure };

export function parseUnitOfMeasure(raw: string): Result<UnitOfMeasure, "INVALID"> {
  const unit = UNITS_OF_MEASURE.find((candidate) => candidate === raw);
  return unit === undefined ? err("INVALID") : ok(unit);
}
