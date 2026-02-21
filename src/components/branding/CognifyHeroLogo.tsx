// Local logo for Vite; in Figma plugin use: import logoImage from "figma:asset/b89d1081f04d6e8ba6ba7c7974de10f5986914b5.png"
const logoImage = "/logo.png";

interface CognifyHeroLogoProps {
  /**
   * Size in pixels for the square container
   * @default 96
   */
  size?: number;
  
  /**
   * Alt text for the logo
   * @default "Cognify"
   */
  alt?: string;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

/**
 * SINGLE SOURCE OF TRUTH for ALL Cognify logos across the entire website.
 * 
 * This component matches the hero logo styling exactly.
 * Every logo (marketing + Communication Gym + headers + cards) uses this component.
 * 
 * CRITICAL RULES:
 * - Container is always square (size × size)
 * - Border radius is ALWAYS 16px (locked constant)
 * - Same shadow, border, and background everywhere
 * - Image uses object-fit: cover for perfect fill
 * - overflow: hidden on the SAME element with borderRadius
 * - Only size changes between usages
 * 
 * USAGE ACROSS ENTIRE WEBSITE:
 * - Hero (middle): size={96} (desktop) / size={72} (mobile)
 * - Headers (top-left): size={40} (desktop) / size={32} (mobile)
 * - Cards / small spots: size={28} or size={40}
 * - Marketing pages: size={40}
 * 
 * NO VARIANTS. NO OVERRIDES. ONE STYLE EVERYWHERE.
 */

// Single constant for border radius - THE ONLY RADIUS VALUE USED ANYWHERE
const LOGO_RADIUS = 16;

export function CognifyHeroLogo({ 
  size = 96,
  alt = "Cognify",
  className = "" 
}: CognifyHeroLogoProps) {
  return (
    <div
      className={`flex-shrink-0 overflow-hidden bg-white shadow-sm border border-black/5 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${LOGO_RADIUS}px`
      }}
    >
      <img
        src={logoImage}
        alt={alt}
        className="w-full h-full"
        style={{
          objectFit: "cover",
          objectPosition: "center"
        }}
      />
    </div>
  );
}
