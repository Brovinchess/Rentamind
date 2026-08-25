import {
  Brain,
  Clapperboard,
  Flag,
  Landmark,
  Mic,
  Moon,
  Stethoscope,
  Target,
  Trophy,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps a listing's icon hint (legacy emoji values from the DB, or icon names)
 * to a themed SVG icon. Unknown hints fall back to the Brain mark.
 */
const MAP: Record<string, LucideIcon> = {
  "🎤": Mic,
  mic: Mic,
  "🏀": Trophy,
  trophy: Trophy,
  "⛳": Flag,
  flag: Flag,
  "🌙": Moon,
  moon: Moon,
  "🎬": Clapperboard,
  film: Clapperboard,
  "🇺🇸": Landmark,
  landmark: Landmark,
  "🩺": Stethoscope,
  stethoscope: Stethoscope,
  "🐋": Waves,
  waves: Waves,
  "⚽": Target,
  target: Target,
  "🧠": Brain,
  brain: Brain,
};

export const ICON_CHOICES = [
  { value: "brain", label: "Brain" },
  { value: "mic", label: "Microphone" },
  { value: "trophy", label: "Trophy" },
  { value: "flag", label: "Flag" },
  { value: "moon", label: "Moon" },
  { value: "film", label: "Film" },
  { value: "landmark", label: "Landmark" },
  { value: "stethoscope", label: "Stethoscope" },
  { value: "waves", label: "Waves" },
  { value: "target", label: "Target" },
];

export default function MindIcon({ hint, size = 24 }: { hint?: string | null; size?: number }) {
  const Icon = (hint && MAP[hint.trim()]) || Brain;
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}
