export function revocarUrlConDemora(
  url: string,
  revocar: (url: string) => void = URL.revokeObjectURL,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => revocar(url), 1_000);
}
