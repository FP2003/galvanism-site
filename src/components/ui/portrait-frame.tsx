import Image from "next/image";
import { HexFrame } from "./hex-frame";

/*
 * Character thumbnail: hexagonal frame around the callsign-initials
 * placeholder, but a plain bordered square once a portrait GIF exists. A
 * mini's rendered background rarely matches the UI's void-navy fill, so
 * clipping it to the hex would crop the render unpredictably and show
 * whatever's outside the polygon's corners — a square box is the safe
 * default for arbitrary uploaded art. `unoptimized` is load-bearing: Next's
 * image optimizer re-encodes and freezes GIF animation otherwise.
 */
export function PortraitFrame({
  size,
  portraitUrl,
  imageSizes,
  fallback,
}: {
  size: string;
  portraitUrl: string | null;
  imageSizes: string;
  fallback: React.ReactNode;
}) {
  if (!portraitUrl) {
    return <HexFrame size={size}>{fallback}</HexFrame>;
  }
  return (
    <div className={`relative shrink-0 overflow-hidden border-2 border-steel-blue bg-void-navy ${size}`}>
      <Image src={portraitUrl} alt="" fill unoptimized sizes={imageSizes} className="object-cover" />
    </div>
  );
}
