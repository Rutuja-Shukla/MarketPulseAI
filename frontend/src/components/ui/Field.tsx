import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function FieldShell({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink">
          {label}
          {required ? <span className="ml-1 text-negative">*</span> : null}
        </label>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-[11.5px] text-negative">{error}</p> : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-sm border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClass, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlClass, "min-h-[96px] resize-y leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlClass, "appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, required, className, ...props },
  ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Input ref={ref} id={id} required={required} {...props} />
    </FieldShell>
  );
});

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, required, className, ...props },
  ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Textarea ref={ref} id={id} required={required} {...props} />
    </FieldShell>
  );
});

export function OptionCard({
  selected,
  onClick,
  title,
  description,
  meta,
  disabled,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-sm border p-4 text-left transition-all duration-200 ease-editorial",
        selected
          ? "border-navy bg-navy/[0.04] shadow-quiet"
          : "border-line bg-paper hover:border-muted/40",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13.5px] font-medium text-ink">{title}</span>
        <span
          className={cn(
            "mt-1 h-3 w-3 shrink-0 rounded-full border transition-colors",
            selected ? "border-navy bg-navy" : "border-line bg-transparent group-hover:border-muted",
          )}
          aria-hidden
        />
      </div>
      {description ? <p className="mt-2 text-[12px] leading-relaxed text-muted">{description}</p> : null}
      {meta ? <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">{meta}</div> : null}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border border-line bg-paper p-4">
      <div>
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {description ? <p className="mt-1 text-[11.5px] text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-navy bg-navy" : "border-line bg-subtle",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-paper shadow transition-all",
            checked ? "left-[18px] bg-canvas" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
