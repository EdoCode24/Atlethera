"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { LOCALE_COOKIE, locales } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { useApp } from "./AppContext";

const buttonBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[0.7rem] px-5 text-[0.95rem] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45";

export function Button({ variant = "primary", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      type="button"
      className={cn(
        buttonBase,
        variant === "primary" && "bg-volt text-night-950 hover:bg-volt-soft",
        variant === "ghost" && "text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6",
        variant === "danger" && "bg-signal text-night-950 hover:bg-signal/85",
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ label, active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-[0.7rem] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35",
        active ? "bg-chalk text-night-950" : "text-chalk-dim hover:bg-chalk/8 hover:text-chalk",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className, ...rest }: FieldProps) {
  const id = useId();
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  // The hint and error stay outside the label: they describe the field, they are not its name.
  return (
    <div className={cn("block", className)}>
      <label htmlFor={id} className="block">
        <span className="text-[0.85rem] font-medium text-chalk-dim">{label}</span>
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        // React focuses autoFocus fields itself and leaves no attribute; Dialog looks for this one.
        data-autofocus={rest.autoFocus || undefined}
        className={cn(
          "mt-2 h-12 w-full rounded-[0.7rem] bg-night-950/70 px-3.5 text-[1rem] text-chalk outline-none transition-shadow placeholder:text-mist/70",
          // One ring at a time: two shadow classes on one element don't reliably override each other.
          error ? "shadow-[inset_0_0_0_1.5px_var(--color-signal)]" : "shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]",
        )}
        {...rest}
      />
      {error ? (
        <span id={`${id}-error`} className="mt-1.5 block text-[0.82rem] text-signal">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1.5 block text-[0.82rem] text-mist">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-[0.85rem] font-medium text-chalk-dim">{label}</span>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full resize-y rounded-[0.7rem] bg-night-950/70 px-3.5 py-3 text-[0.95rem] text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none placeholder:text-mist/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
      />
    </label>
  );
}

/** A choice between a few options, shown as a row of buttons. */
export function Choice<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[0.85rem] font-medium text-chalk-dim">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-[0.65rem] px-3.5 text-[0.9rem] font-semibold transition-colors",
              o.value === value ? "bg-chalk text-night-950" : "bg-chalk/6 text-chalk-dim hover:text-chalk",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Backdrop clicks for a modal <dialog> (a click on ::backdrop targets the dialog itself). It only
 * closes when the press started and ended there too: a text selection dragged out of a field ends
 * with a click on the dialog, and must not throw the typing away.
 */
export function useBackdropClose(onClose: () => void) {
  const pressed = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
      pressed.current = e.target === e.currentTarget;
    },
    onPointerUp: (e: PointerEvent<HTMLDialogElement>) => {
      if (e.target !== e.currentTarget) pressed.current = false;
    },
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      const backdrop = pressed.current && e.target === e.currentTarget;
      pressed.current = false;
      if (backdrop) onClose();
    },
  };
}

/** Where typing goes when a dialog opens: its autoFocus field, else its first text field. */
const TEXT_FIELD = "input:not([type=hidden],[type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[disabled]), textarea:not([disabled])";
const SINGLE_LINE = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/** A modal on the native <dialog>: focus trap, Escape and the top layer come for free. */
export function Dialog({
  open,
  onClose,
  onSubmit,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Makes the dialog a form: Enter in a single-line field submits, and so does a footer button of
   * type="submit". Leave it out when the body has a form of its own (forms can't nest).
   */
  onSubmit?: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useApp();
  const backdrop = useBackdropClose(onClose);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // React's autoFocus ran while the dialog was still closed, and showModal() then picked the
      // first focusable element: the close button.
      (el.querySelector<HTMLElement>("[data-autofocus], [autofocus]") ?? el.querySelector<HTMLElement>(TEXT_FIELD))?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const content = (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-4">
        <h2 id={titleId} className="text-[1.1rem] font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label={t.common.close} className="grid size-9 place-items-center rounded-md text-mist hover:text-chalk">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-hairline px-6 py-4">{footer}</footer>}
    </>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      {...backdrop}
      className={cn(
        "m-auto max-h-[min(90dvh,52rem)] w-[calc(100%-2rem)] overflow-hidden rounded-[var(--radius-panel)] bg-night-850 p-0 text-chalk shadow-[0_0_0_1px_var(--color-hairline-strong),0_40px_120px_-30px_rgb(0_0_0/0.9)] backdrop:bg-night-950/70",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open &&
        (onSubmit ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            onKeyDown={(e) => {
              // Enter submits from any single-line field, whether or not the footer has a submit
              // button (the browser's own implicit submission needs one once there are two fields).
              const field = e.target;
              if (e.key !== "Enter" || e.nativeEvent.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
              if (!(field instanceof HTMLInputElement) || !SINGLE_LINE.has(field.type)) return;
              e.preventDefault();
              e.currentTarget.requestSubmit();
            }}
            className="flex max-h-[inherit] flex-col"
          >
            {content}
          </form>
        ) : (
          <div className="flex max-h-[inherit] flex-col">{content}</div>
        ))}
    </dialog>
  );
}

/** TR / EN: the same page in the other language. The cookie keeps the choice for the next visit to "/". */
export function LocaleSwitch({ className }: { className?: string }) {
  const { t, locale } = useApp();
  const pathname = usePathname();
  const rest = pathname.replace(/^\/[^/]+/, "");
  return (
    <div role="group" aria-label={t.common.language} className={cn("inline-flex h-10 shrink-0 items-center gap-0.5 rounded-[0.7rem] p-0.5 shadow-[inset_0_0_0_1px_var(--color-hairline)]", className)}>
      {locales.map((l) =>
        l === locale ? (
          <span key={l} aria-current="true" className="grid h-9 min-w-10 place-items-center rounded-[0.55rem] bg-chalk/10 px-2 text-[0.78rem] font-semibold tracking-[0.06em] text-chalk">
            {l.toUpperCase()}
          </span>
        ) : (
          <a
            key={l}
            href={`/${l}${rest}`}
            hrefLang={l}
            lang={l}
            aria-label={t.common.switchLanguage}
            onClick={(e) => {
              document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
              // Keep the query (onboarding's ?package=) and hash of the page as it is now.
              e.currentTarget.href = `/${l}${rest}${window.location.search}${window.location.hash}`;
            }}
            className="grid h-9 min-w-10 place-items-center rounded-[0.55rem] px-2 text-[0.78rem] font-semibold tracking-[0.06em] text-mist transition-colors hover:bg-chalk/6 hover:text-chalk"
          >
            {l.toUpperCase()}
          </a>
        ),
      )}
    </div>
  );
}
