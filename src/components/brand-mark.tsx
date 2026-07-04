/*
 * F.C.B. seal — a hexagon enclosing a lens/aperture, the shield/lens motif from
 * DESIGN.md. Line-art only, inherits currentColor. This is the one bespoke mark;
 * everything else uses the lucide icon set.
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
    >
      {/* Outer hex */}
      <path d="M24 3 42 13.5 42 34.5 24 45 6 34.5 6 13.5 Z" />
      {/* Aperture blades */}
      <circle cx="24" cy="24" r="9" />
      <path d="M24 15 27 22.5 M33 24 25.5 27 M24 33 21 25.5 M15 24 22.5 21" />
      {/* Core */}
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
