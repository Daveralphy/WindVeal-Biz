/**
 * The WindVeal logo. Follows the page theme: the dark-text version on light pages and the
 * white-text version on dark pages. Use `tone="light"` on surfaces that are always dark
 * (photo heroes, navy footers) and `tone="dark"` on surfaces that are always light.
 */
export function BrandLogo({ height, tone = "auto", className = "" }: { height?: number; tone?: "auto" | "light" | "dark"; className?: string }) {
  const mode = tone === "light" ? "always-light" : tone === "dark" ? "fixed" : "";
  return (
    <span className={`wv-logo ${mode} ${className}`.trim()} style={height ? { height } : undefined} role="img" aria-label="WindVeal">
      <img className="on-light" src="/logo.png" alt="" draggable={false} />
      <img className="on-dark" src="/logo-light.png" alt="" draggable={false} />
    </span>
  );
}
