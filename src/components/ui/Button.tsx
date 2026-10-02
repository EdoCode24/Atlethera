import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost";

const base =
  "group/button relative inline-flex h-13 items-center justify-center gap-2 rounded-[0.7rem] px-6 text-[0.98rem] font-semibold tracking-[-0.005em] transition-[background-color,color,box-shadow] duration-300 ease-(--ease-out-expo)";

const variants: Record<Variant, string> = {
  primary:
    "bg-volt text-night-950 hover:bg-volt-soft",
  ghost: "text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6 hover:shadow-[inset_0_0_0_1px_rgb(242_244_237/0.32)]",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  children: ReactNode;
}

export function ButtonLink({ variant = "primary", className, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={buttonClass(variant, className)} {...rest}>
      {children}
    </a>
  );
}
