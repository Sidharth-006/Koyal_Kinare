import React from 'react';
import { clsx } from 'clsx';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options,
  className,
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all duration-200 shadow-2xs',
          error ? 'border-danger focus:ring-danger/15 focus:border-danger' : 'border-border',
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';
