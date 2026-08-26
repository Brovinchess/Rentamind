import { NextResponse } from "next/server";
import {
  createTrainingPlan,
  getStudyLog,
  getTrainingPlan,
  getTrainingPlans,
  updateTrainingPlan,
} from "@/lib/db";
import { ARCHETYPES, chunkSources, feedPrompt, identityPrompt, type ArchetypeKey, type Brief } from "@/lib/curriculum";
import { listMindsCached, minds } from "@/lib/minds";
import { trainAlias } from "@/lib/study";

export const maxDuration = 120;

/** Best-effort: equip a web-search app from the Bazaar so the Mind can research. */
async function equipSearchTool(mindId: string): Promise<string | null> {
  const c = minds();
  try {
    const isSearchApp = (name: unknown) => /tavily|perplexity|serp|web.?search/i.test(String(name ?? ""));
    const equipped = await c.listEquippedApps(mindId);
    const has = equipped.find((a) => isSearchApp(a.appName));
    if (has) return String(has.appName);
    for (const term of ["tavily", "perplexity", "serp"]) {
      const res = await c.bazaar.listApps({ search: term, tier: "verified" });
      const app = res.items?.find((a) => a.appId && isSearchApp(a.appName));
      if (app?.appId) {
        await c.equipApps(mindId, { ids: [app.appId] });
        return String(app.appName ?? term);
      }
    }
  } catch {
    // research still works from the model's own knowledge
  }
  return null;
}

/** GET /api/studio — all plans with recent study logs. */
export async function GET() {
  try {
    const plans = await getTrainingPlans();
    const out = await Promise.all(
      plans.map(async (p) => ({ ...p, log: await getStudyLog(p.id, 10).catch(() => []) })),
    );
    return NextResponse.json({ plans: out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "studio error" }, { status: 500 });
  }
}

/** POST /api/studio — start a persona: identity + sources, then the auto-study loop takes over. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const archetype = body.archetype as ArchetypeKey;
    if (!ARCHETYPES[archetype]) {
      return NextResponse.json({ error: "Unknown persona type" }, { status: 400 });
    }
    const { mindId, personaName, who, tone, sources } = body;
    const frequency = Math.max(1, Math.min(168, Number(body.frequencyHours) || 24));
    if (!mindId || !personaName?.trim() || !who?.trim()) {
      return NextResponse.json({ error: "mindId, personaName, and who are required" }, { status: 400 });
    }
    const owned = await listMindsCached();
    const trainee = owned.find((m) => m.mindId === mindId);
    if (!trainee) {
      return NextResponse.json({ error: "That Mind isn't on your account" }, { status: 403 });
    }
    const existing = await getTrainingPlans();
    if (existing.some((p) => p.mind_id === mindId)) {
      return NextResponse.json({ error: "This Mind already has a persona plan — pause or adjust it in the Studio" }, { status: 409 });
    }

    const brief: Brief = {
      personaName: String(personaName).trim().slice(0, 80),
      who: String(who).trim().slice(0, 2000),
      tone: String(tone ?? "").trim().slice(0, 500),
      sources: String(sources ?? "").slice(0, 6000),
    };

    // Send identity + source material now (fire-and-forget; the Mind absorbs them).
    const alias = trainAlias(mindId);
    const c = minds();
    await c.ensureConversation(alias, mindId);
    await c.sendMessage({ alias, messageText: identityPrompt(archetype, brief) });
    const chunks = chunkSources(brief.sources);
    for (let i = 0; i < chunks.length; i++) {
      await c.sendMessage({ alias, messageText: feedPrompt(brief, chunks[i], i + 1, chunks.length) });
    }
    const equippedTool = await equipSearchTool(mindId);

    const plan = await createTrainingPlan({
      mind_id: mindId,
      mind_name: trainee.name ?? "unnamed",
      archetype,
      persona_name: brief.personaName,
      brief: brief as unknown as Record<string, unknown>,
      study_frequency_hours: frequency,
      next_study_at: new Date().toISOString(), // first study cycle fires on the next scheduler pass
      is_studying: true,
    });

    return NextResponse.json({ planId: plan.id, equippedTool });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "studio error" }, { status: 500 });
  }
}

/** PATCH /api/studio — adjust a plan: frequency, pause/resume. */
export async function PATCH(req: Request) {
  try {
    const { planId, frequencyHours, isStudying } = await req.json();
    const plan = planId ? await getTrainingPlan(planId) : null;
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (frequencyHours !== undefined) {
      patch.study_frequency_hours = Math.max(1, Math.min(168, Number(frequencyHours) || 24));
    }
    if (isStudying !== undefined) {
      patch.is_studying = !!isStudying;
      if (isStudying && !plan.next_study_at) patch.next_study_at = new Date().toISOString();
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    await updateTrainingPlan(plan.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "studio error" }, { status: 500 });
  }
}
