// Rent a Mind — database check script.
// Usage: node --env-file=.env.local scripts/seed.mjs
//
// This app no longer ships seed listings: Minds are listed for rent by their
// stewards through the dashboard ("List a Mind"), and points are only earned
// through real activity. This script just verifies the schema is reachable.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("supabase env missing");
const db = createClient(url, key, { auth: { persistSession: false } });

for (const t of ["ram_listings", "ram_rentals", "ram_points_events", "ram_ratings"]) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${t}: ${error.message} — run supabase/schema.sql in the SQL editor`);
  console.log(`${t}: ${count} rows`);
}
console.log("schema OK — list Minds from the dashboard to populate the marketplace");
