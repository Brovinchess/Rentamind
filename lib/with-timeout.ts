/**
 * Time-box a Builder API call.
 *
 * Some calls hang *indefinitely* on Minds with large conversation histories —
 * `getLatestHistoryFingerprint` is the known offender, and it is worst on
 * exactly the well-trained Minds people list for rent. An unbounded call burns
 * the whole serverless budget and returns nothing, which is how the study loop
 * silently stalled for five days (QA pass 6) and how chat broke for every
 * trained Mind (QA pass 8).
 *
 * Deliberately import-free so any module can use it without risking a cycle.
 */
export const CALL_TIMEOUT_MS = 20_000;
/** Calls that are nice-to-have: bail fast and carry on without them. */
export const OPTIONAL_CALL_TIMEOUT_MS = 5_000;

export function withTimeout<T>(p: Promise<T>, label: string, ms = CALL_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)),
  ]);
}

/** Run an optional call; return `undefined` instead of throwing when it stalls. */
export async function optional<T>(
  p: Promise<T>,
  label: string,
  ms = OPTIONAL_CALL_TIMEOUT_MS,
): Promise<T | undefined> {
  try {
    return await withTimeout(p, label, ms);
  } catch {
    return undefined;
  }
}
