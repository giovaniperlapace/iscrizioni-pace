import type { LucideProps } from "lucide-react";

export function CurtainIcon({ size = 24, ...props }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 3h20M3 3v18h4l-1-9c4-1 6-5 6-9M21 3v18h-4l1-9c-4-1-6-5-6-9M3 12h3m12 0h3M7 21h10" />
    </svg>
  );
}
