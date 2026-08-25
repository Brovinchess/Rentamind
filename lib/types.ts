export type SampleQA = { q: string; a: string };

export type Listing = {
  id: string;
  mind_id: string | null;
  mind_name: string;
  steward_email: string;
  steward_name: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  emoji: string;
  label: string;
  sample_qa: SampleQA[];
  rate_cognition_per_day: number;
  min_days: number;
  max_concurrent: number;
  training_score: number;
  rating: number;
  rating_count: number;
  is_seeded: boolean;
  is_active: boolean;
  created_at: string;
};

export type Rental = {
  id: string;
  listing_id: string;
  renter_email: string;
  days: number;
  starts_at: string;
  ends_at: string;
  status: "active" | "expired" | "ended";
  cognition_funded: number;
  cognition_used: number;
  usage_settled_at: string | null;
  circle_added: boolean;
  created_at: string;
};

export type PointsEvent = {
  id: string;
  subject_email: string;
  subject_name: string | null;
  role: "steward" | "renter";
  event_type: "training" | "rental_supply" | "renter_usage" | "bonus" | "seed";
  points: number;
  meta: Record<string, unknown>;
  created_at: string;
};

export type LeaderboardRow = {
  email: string;
  name: string;
  points: number;
  rank: number;
};
