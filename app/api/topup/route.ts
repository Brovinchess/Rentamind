import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { CHECKOUT_MAX_CENTS, CHECKOUT_MIN_CENTS, createMindCheckout } from "@/lib/core-api";
import { listMindsFor } from "@/lib/minds";

/**
 * POST /api/topup {mindId, amountCents}
 *
 * Funds a Mind's cognition through the HelloMinds Core API's public Stripe
 * checkout. We only allow it for Minds the signed-in user actually owns — the
 * upstream endpoint is anonymous and would happily take money for anyone's Mind,
 * which is not a thing this app should let you do by accident.
 *
 * Ethoswarm currently rejects every well-formed request for our Minds with a
 * generic "Bad Request" (they appear not to be payments-provisioned). We return
 * that verbatim rather than pretending it worked.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  try {
    const { mindId, amountCents } = await req.json();
    const id = String(mindId ?? "");

    // Strict: only a real integer, and only within our own bounds. A success
    // here sends the user to a live Stripe page, so nothing sloppy goes upstream.
    if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
      return NextResponse.json({ error: "amountCents must be a whole number of cents." }, { status: 400 });
    }
    const cents = amountCents;
    if (cents < CHECKOUT_MIN_CENTS) {
      return NextResponse.json(
        { error: `Minimum top-up is $${(CHECKOUT_MIN_CENTS / 100).toFixed(2)}.` },
        { status: 400 },
      );
    }
    if (cents > CHECKOUT_MAX_CENTS) {
      return NextResponse.json(
        { error: `Maximum top-up is $${CHECKOUT_MAX_CENTS / 100}.` },
        { status: 400 },
      );
    }

    const owned = await listMindsFor(user.accessToken).catch(() => []);
    if (!owned.some((m) => m.mindId === id)) {
      return NextResponse.json({ error: "That's not one of your Minds." }, { status: 403 });
    }

    const origin = new URL(req.url).origin;
    const result = await createMindCheckout({
      mindId: id,
      amountCents: cents,
      email: user.email,
      successUrl: `${origin}/my-minds?topup=ok`,
      cancelUrl: `${origin}/my-minds?topup=cancelled`,
    });

    if (result.ok) return NextResponse.json({ url: result.url });
    return NextResponse.json(
      {
        error: result.reason,
        // Tells the UI to offer the manual HelloMinds route instead of blaming the user.
        upstream: result.upstream,
      },
      { status: result.upstream ? 502 : 400 },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "top-up error" }, { status: 500 });
  }
}
