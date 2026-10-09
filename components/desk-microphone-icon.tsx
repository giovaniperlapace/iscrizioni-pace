import type { LucideProps } from "lucide-react";

/** Gooseneck microphone with a tabletop base, matching the sidebar icon size. */
export function DeskMicrophoneIcon({ size = 24, ...props }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="3" width="8" height="3.5" rx="1.75" transform="rotate(18 2 3)" fill="currentColor" />
      <path d="M10 6.8c2.4.6 3.7 1.7 4.8 3.9l4.1 8.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.8 17.8 17 19.1l1.2 2.4 2.6-1.3-1.2-2.4Z" fill="currentColor" />
      <path d="M4 22a7 7 0 0 1 14 0H4Z" fill="currentColor" />
    </svg>
  );
}
