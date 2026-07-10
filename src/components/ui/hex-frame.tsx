const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

/*
 * Hexagonal avatar frame. A plain CSS `border` on a clip-path'd box draws an
 * uneven stroke on the diagonal faces (the border is a rectangle, sliced by
 * an unrelated hex polygon) — so the "border" here is really an outer hex
 * filled with the border color, with an inner hex (inset by `borderWidth`,
 * same polygon) filled with the background sitting on top. Both layers scale
 * off the same percentage-based clip-path, so the ring stays a uniform width
 * on every face, including the diagonals.
 */
export function HexFrame({
  size,
  borderWidth = 2,
  className = "",
  children,
}: {
  size: string;
  borderWidth?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative shrink-0 bg-steel-blue ${size} ${className}`}
      style={{ clipPath: HEX_CLIP }}
    >
      <div
        className="absolute flex items-center justify-center overflow-hidden bg-void-navy"
        style={{ clipPath: HEX_CLIP, inset: borderWidth }}
      >
        {children}
      </div>
    </div>
  );
}
