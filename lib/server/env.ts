
/** True when every named environment variable is set to a non-empty value. */
export function hasEnv(...names: string[]): boolean {
  return names.every((n) => !!process.env[n] && process.env[n]!.trim() !== '');
}
