/** Sample pure function; it exists to prove the property-testing setup end to end. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
