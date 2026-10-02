import Image from "next/image";
import mark from "@/assets/brand/atlethera-mark.png";
import { cn } from "@/lib/cn";

/** The Atlethera mark (logo/logo.png): a white and volt "A", made for dark surfaces. */
export function LogoMark({ className }: { className?: string }) {
  return <Image src={mark} alt="" aria-hidden="true" width={64} height={64} className={cn("shrink-0 object-contain", className)} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span className="display text-[1.55rem] leading-none tracking-[0.03em]">Atlethera</span>
    </span>
  );
}
