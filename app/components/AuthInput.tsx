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

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-brand/80">
        {label}
        {props.required && <span className="text-brand ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand/30">
            <Icon className="w-4 h-4" strokeWidth={1.8} />
          </span>
        )}
        <input
          id={id}
          name={id}
          type={inputType}
          className={`w-full rounded-xl border bg-white py-3 text-sm text-brand placeholder:text-brand/30 outline-none transition-colors
            focus:border-brand focus:ring-2 focus:ring-brand/15
            ${error ? "border-red-400" : "border-cream"}
            ${Icon ? "pl-10" : "pl-4"}
            ${isPassword ? "pr-10" : "pr-4"}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand/30 hover:text-brand transition-colors"
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
