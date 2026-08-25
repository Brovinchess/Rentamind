import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Listing, PointsEvent, Rental } from "./types";

let _db: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars missing");
    _db = createClient(url, key, { auth: { persistSession: false } });
  }
  return _db;
}

export async function getListings(): Promise<Listing[]> {
  const { data, error } = await db()
    .from("ram_listings")
    .select("*")
    .eq("is_active", true)
    .order("training_score", { ascending: false });
  if (error) throw new Error(`listings: ${error.message}`);
  return (data ?? []) as Listing[];
}

export async function getListing(id: string): Promise<Listing | null> {
  const { data, error } = await db().from("ram_listings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`listing: ${error.message}`);
  return (data as Listing) ?? null;
}

export async function createListing(row: Partial<Listing>): Promise<Listing> {
  const { data, error } = await db().from("ram_listings").insert(row).select().single();
  if (error) throw new Error(`create listing: ${error.message}`);
  return data as Listing;
}

export async function getRentalsForListing(listingId: string, status?: string): Promise<Rental[]> {
  let q = db().from("ram_rentals").select("*").eq("listing_id", listingId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`rentals: ${error.message}`);
  return (data ?? []) as Rental[];
}

export async function getActiveRentals(): Promise<Rental[]> {
  const { data, error } = await db().from("ram_rentals").select("*").eq("status", "active");
  if (error) throw new Error(`active rentals: ${error.message}`);
  return (data ?? []) as Rental[];
}

export async function getRentalsByRenter(email: string): Promise<Rental[]> {
  const { data, error } = await db()
    .from("ram_rentals")
    .select("*")
    .eq("renter_email", email.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw new Error(`renter rentals: ${error.message}`);
  return (data ?? []) as Rental[];
}

export async function createRental(row: Partial<Rental>): Promise<Rental> {
  const { data, error } = await db().from("ram_rentals").insert(row).select().single();
  if (error) throw new Error(`create rental: ${error.message}`);
  return data as Rental;
}

export async function updateRental(id: string, patch: Partial<Rental>): Promise<void> {
  const { error } = await db().from("ram_rentals").update(patch).eq("id", id);
  if (error) throw new Error(`update rental: ${error.message}`);
}

export async function getRental(id: string): Promise<Rental | null> {
  const { data, error } = await db().from("ram_rentals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`rental: ${error.message}`);
  return (data as Rental) ?? null;
}

export async function addPoints(rows: Partial<PointsEvent>[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db().from("ram_points_events").insert(rows);
  if (error) throw new Error(`points: ${error.message}`);
}

export async function getPointsEvents(limit = 200): Promise<PointsEvent[]> {
  const { data, error } = await db()
    .from("ram_points_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`points events: ${error.message}`);
  return (data ?? []) as PointsEvent[];
}

export async function getAllPointsEvents(): Promise<PointsEvent[]> {
  const { data, error } = await db().from("ram_points_events").select("subject_email, subject_name, points");
  if (error) throw new Error(`points all: ${error.message}`);
  return (data ?? []) as PointsEvent[];
}
