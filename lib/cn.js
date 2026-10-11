/** Join class names, skipping falsy values. (No tailwind-merge: components avoid conflicting
 *  utilities by design — variants are complete class sets, callers add layout classes only.) */
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(" ");
}
