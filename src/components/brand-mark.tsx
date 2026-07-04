import Image from "next/image";

// F.C.B. seal — the Galvanism hexagon/lens mark (info/card_design/galvanism_logo).
// Cyan artwork on transparent, so it drops onto the navy UI directly. `size` sets
// the rendered height; width follows the artwork's aspect ratio. `className` is
// kept for layout utilities (legacy text-color classes are harmless no-ops now).
//
// `unoptimized`: the source is a 15KB transparent WebP; the image optimizer can
// fall back to JPEG (no alpha) for clients that don't advertise WebP, which would
// give the mark a solid background. Serving the original as-is avoids that.
const ASPECT = 259 / 225; // intrinsic width / height of the source art

export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/galvanism-logo.webp"
      alt=""
      aria-hidden="true"
      width={Math.round(size * ASPECT)}
      height={size}
      className={className}
      priority
      unoptimized
    />
  );
}
