import { mindsFor } from "./minds";

/**
 * Minimum real cognition a Mind needs before we let it be rented or answer a
 * paid message. Below this, a reply would likely fail — so we block instead of
 * taking the renter's spend for nothing.
 */
export const MIN_MIND_COGNITION = 30;

/** Best-effort live balance for a Mind via its owner's key; null if unreadable. */
export async function mindBalance(ownerKey: string, mindId: string): Promise<number | null> {
  try {
    const b = await mindsFor(ownerKey).getCognitionBalance(mindId);
    return Number(b.cognition);
  } catch {
    return null;
  }
}
