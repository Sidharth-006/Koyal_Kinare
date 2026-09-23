import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all duration-200 shadow-2xs',
            leftIcon && 'pl-10',
            error ? 'border-danger focus:ring-danger/15 focus:border-danger' : 'border-border',
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
      {!error && helperText && <span className="text-xs text-slate-500">{helperText}</span>}
    </div>
  );
});

Input.displayName = 'Input';
