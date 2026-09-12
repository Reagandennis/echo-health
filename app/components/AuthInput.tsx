"use client";

import { useState } from "react";
import { Eye, EyeOff, LucideIcon } from "lucide-react";

interface AuthInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  readonly id: string;
  readonly label: string;
  readonly type?: string;
  readonly icon?: LucideIcon;
  readonly error?: string;
}

export default function AuthInput({
  id,
  label,
  type = "text",
  icon: Icon,
  error,
  ...props
}: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (visible ? "text" : "password") : type;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
        {props.required && <span className="text-rose-600 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
            <Icon className="w-4 h-4" strokeWidth={1.8} />
          </span>
        )}
        {/* The border was `cream` — mint on white at 1.1:1, so an empty field
            had no visible edge. stone-300 is the lightest that reads as one.

            `min-h-11` is the 44px touch target, not a style preference: these
            fields are now real credential inputs on a phone rather than a
            button that hands off to a hosted login page. */}
        <input
          id={id}
          name={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`min-h-11 w-full rounded-xl border bg-white py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-xs outline-none transition
            focus:ring-4
            ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : "border-stone-300 focus:border-brand-500 focus:ring-brand-500/15"}
            ${Icon ? "pl-10" : "pl-3.5"}
            ${isPassword ? "pr-12" : "pr-3.5"}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-400 transition-colors hover:text-stone-700"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.8} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>
      {error && <p id={errorId} className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
