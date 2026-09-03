import { getBuilderKeyForEmail, type AuthedUser } from "./auth";
import { getListing, getRental } from "./db";
import { listMindsFor } from "./minds";
import type { Listing, Rental } from "./types";

export function stewardAlias(mindId: string) {
  return `ram-${mindId.slice(0, 8)}`;
}
export function rentalAlias(mindId: string, rentalId: string) {
  return `ram-${mindId.slice(0, 8)}-${rentalId.slice(0, 8)}`;
}

/** Mind replies arrive as HTML; flatten for chat bubbles and strip the service envelope. */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
    .replace(/^\[RENTAL SESSION[^\]]*\][ \t\r\n]*/, "");
}

export type ChatAccess =
  | { kind: "trainer"; mindId: string; alias: string; key: string }
  | { kind: "renter"; mindId: string; alias: string; key: string; rental: Rental; listing: Listing }
  | { error: string; status: number };

/**
 * Trainer path: your own mindId — raw training channel via YOUR key.
 * Renter path: listingId + your rentalId — proxied session via the OWNER's stored key.
 */
export async function resolveChatAccess(
  user: AuthedUser | null,
  listingId: string | null,
  mindId: string | null,
  rentalId: string | null,
): Promise<ChatAccess> {
  if (!user) return { error: "Sign in required", status: 401 };

  if (mindId) {
    const owned = await listMindsFor(user.builderKey);
    if (!owned.some((m) => m.mindId === mindId)) {
      return { error: "That Mind isn't on your account", status: 404 };
    }
    return { kind: "trainer", mindId, alias: stewardAlias(mindId), key: user.builderKey };
  }
  if (listingId) {
    const listing = await getListing(listingId);
    if (!listing?.mind_id) return { error: "Not a live Mind", status: 404 };
    if (!rentalId) return { error: "An active rental is required to chat with this Mind", status: 403 };
    const rental = await getRental(rentalId).catch(() => null);
    if (!rental || rental.listing_id !== listingId) {
      return { error: "Rental not found for this listing", status: 403 };
    }
    if (rental.renter_email !== user.email) {
      return { error: "This rental belongs to a different account", status: 403 };
    }
    if (rental.status !== "active" || new Date(rental.ends_at) <= new Date()) {
      return { error: "This rental has ended — rent the Mind again to keep chatting", status: 403 };
    }
    const ownerKey = await getBuilderKeyForEmail(listing.steward_email);
    if (!ownerKey) return { error: "This Mind's trainer is unavailable right now", status: 409 };
    const alias = rental.conversation_alias ?? rentalAlias(listing.mind_id, rental.id);
    return { kind: "renter", mindId: listing.mind_id, alias, key: ownerKey, rental, listing };
  }
  return { error: "listingId or mindId required", status: 400 };
}
