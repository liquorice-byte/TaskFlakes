interface LogoProps {
  /** Box size in px (the snowflake scales with it). */
  size?: number;
  className?: string;
}

/**
 * TaskFlakes brand mark — a white snowflake on a blue rounded square.
 * Mirrors `public/favicon.svg` so the app icon and favicon stay in sync.
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="TaskFlakes"
    >
      <rect width="32" height="32" rx="7" fill="#2563EB" />
      <g
        transform="translate(16 16)"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      >
        <g id="tf-arm">
          <line x1="0" y1="0" x2="0" y2="-9.5" />
          <line x1="0" y1="-9.5" x2="-2.3" y2="-12" />
          <line x1="0" y1="-9.5" x2="2.3" y2="-12" />
          <line x1="0" y1="-5" x2="-1.8" y2="-6.8" />
          <line x1="0" y1="-5" x2="1.8" y2="-6.8" />
        </g>
        <use href="#tf-arm" transform="rotate(60)" />
        <use href="#tf-arm" transform="rotate(120)" />
        <use href="#tf-arm" transform="rotate(180)" />
        <use href="#tf-arm" transform="rotate(240)" />
        <use href="#tf-arm" transform="rotate(300)" />
      </g>
    </svg>
  );
}
