import type { ReactNode } from "react";

export function AuthCard({ title, body, children, footer, wide }: { title: string; body: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`w-full ${wide ? "max-w-[40rem]" : "max-w-[26rem]"} rounded-[var(--radius-panel)] bg-night-850 p-7 shadow-[0_0_0_1px_var(--color-hairline-strong),0_40px_120px_-40px_rgb(0_0_0/0.9)] sm:p-9`}
    >
      <h1 className="display text-[2.4rem] leading-none">{title}</h1>
      <p className="mt-3 text-[0.95rem] text-chalk-dim">{body}</p>
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-8 border-t border-hairline pt-5 text-[0.9rem] text-mist">{footer}</div>}
    </div>
  );
}
