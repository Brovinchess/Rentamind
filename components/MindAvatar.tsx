/* eslint-disable @next/next/no-img-element */

/**
 * Visual identity for a Mind: a unique generative avatar seeded by its name.
 * DiceBear (open source, free) renders bot-style faces — fitting for AI agents,
 * and no IP issues with persona names.
 */
export default function MindAvatar({
  seed,
  size = 46,
  radius = 12,
  className,
  style,
}: {
  seed: string;
  size?: number;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url =
    `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}` +
    `&backgroundColor=394f95,5a6fb5,2a3b73,e08a2e,f5a04a&backgroundType=gradientLinear`;
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      className={className}
      style={{ borderRadius: radius, flexShrink: 0, display: "block", ...style }}
    />
  );
}
