interface NumiLogoProps {
  /** Height in px. Width follows automatically. */
  height?: number;
  className?: string;
}

/** White numi wordmark (chunky letters, open "u" with two eyes). Colour follows `currentColor`, so it is white via text-white. */
export function NumiLogo({ height = 28, className = "" }: NumiLogoProps) {
  return (
    <svg
      role="img"
      aria-label="numi"
      viewBox="60 150 1440 520"
      style={{ height, width: "auto" }}
      className={`block text-white ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="140" d="M150 580V420C150 330 355 330 355 440V580" />
        <path strokeWidth="118" d="M499 470A121 121 0 0 0 741 470" />
        <path strokeWidth="140" d="M915 580V420C915 330 1080 330 1080 440V580M1080 440C1080 330 1245 330 1245 440V580" />
        <path strokeWidth="140" d="M1412 395V580" />
      </g>
      <g fill="currentColor">
        <circle cx="499" cy="339" r="58" />
        <circle cx="741" cy="339" r="58" />
        <circle cx="1412" cy="230" r="68" />
      </g>
    </svg>
  );
}

export default NumiLogo;
