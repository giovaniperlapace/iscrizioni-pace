import type { LucideProps } from "lucide-react";
export function ChairIcon({ size = 24, ...props }: LucideProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="6" y="2" width="12" height="10" rx="2"/><path d="M6 12 4 16h16l-2-4M5 16v6m14-6v6M8 5h8"/></svg>;
}
