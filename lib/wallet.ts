import type { AuthedUser } from "./auth";
import { db } from "./db";
import { listMindsFor, mindsFor } from "./minds";

/**
 * Proof-of-cognition wallet: a renter's spendable balance is derived from the
 * REAL cognition they hold across their own HelloMinds Minds.
 *
 *   allowance = clamp(50% of real total cognition, 100, 5000)
 *   balance   = allowance − spent
 *
 * The 100 floor is a small starter bonus so brand-new accounts can try one
 * rental; everything above it is backed by verifiable live balances.
 */

export const WALLET_RULE = { SHARE: 0.5, FLOOR: 100, CAP: 5000 };
const SYNC_STALE_MS = 6 * 3600 * 1000;

export type WalletView = {
  email: string;
  realCognition: number | null;
  allowance: number;
  spent: number;
  balance: number;
  syncedAt: string | null;
};

function toView(row: {
  email: string;
  real_cognition: number | null;
  allowance: number | null;
  spent: number;
  synced_at: string | null;
}): WalletView {
  const allowance = Number(row.allowance ?? 0);
  const spent = Number(row.spent ?? 0);
  return {
    email: row.email,
    realCognition: row.real_cognition != null ? Number(row.real_cognition) : null,
    allowance,
    spent,
    balance: Math.max(0, allowance - spent),
    syncedAt: row.synced_at,
  };
}

/** Sum the user's REAL cognition across all their Minds via their own key. */
export async function readRealCognition(builderKey: string): Promise<number> {
  const minds = await listMindsFor(builderKey);
  const c = mindsFor(builderKey);
  const balances = await Promise.allSettled(minds.map((m) => c.getCognitionBalance(m.mindId)));
  return balances.reduce(
    (sum, b) => sum + (b.status === "fulfilled" ? Number(b.value.cognition) || 0 : 0),
    0,
  );
}

/** Sync the wallet's allowance from live balances. */
export async function syncWallet(user: AuthedUser): Promise<WalletView> {
  const real = await readRealCognition(user.builderKey);
  const allowance = Math.min(
    WALLET_RULE.CAP,
    Math.max(WALLET_RULE.FLOOR, Math.round(real * WALLET_RULE.SHARE)),
  );
  const { data, error } = await db()
    .from("ram_wallets")
    .upsert(
      {
        email: user.email,
        real_cognition: Math.round(real),
        allowance,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select()
    .single();
  if (error) throw new Error(`wallet sync: ${error.message}`);
  return toView(data);
}

/** Current wallet; auto-syncs when never synced or stale (needs the user's key). */
export async function getWallet(user: AuthedUser): Promise<WalletView> {
  const { data } = await db().from("ram_wallets").select("*").eq("email", user.email).maybeSingle();
  if (
    !data ||
    data.synced_at == null ||
    Date.now() - new Date(data.synced_at).getTime() > SYNC_STALE_MS
  ) {
    try {
      return await syncWallet(user);
    } catch {
      if (data) return toView(data);
      throw new Error("Could not read your HelloMinds balances to set up your wallet");
    }
  }
  return toView(data);
}

/** Spend from the wallet; returns the new balance or null when insufficient. */
export async function spend(user: AuthedUser, amount: number): Promise<number | null> {
  const wallet = await getWallet(user);
  if (wallet.balance < amount) return null;
  const { error } = await db()
    .from("ram_wallets")
    .update({ spent: wallet.spent + amount })
    .eq("email", user.email);
  if (error) throw new Error(`wallet spend: ${error.message}`);
  return wallet.balance - amount;
}
