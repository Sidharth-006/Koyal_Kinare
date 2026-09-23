import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  icon,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-800 min-h-[44px] min-w-[44px] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shadow-sm';

  const sizeClasses = {
    sm: 'px-3.5 py-2 text-xs gap-1.5',
    md: 'px-4.5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2.5'
  };

  const variantClasses = {
    primary: 'bg-forest-800 text-white hover:bg-forest-900 focus:ring-forest-800 shadow-forest-800/15 border border-forest-800/20',
    secondary: 'bg-white text-forest-800 hover:bg-cream-50 border border-border hover:border-forest-800/30 focus:ring-forest-800',
    accent: 'bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-700 shadow-emerald-700/15',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 shadow-red-600/15',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500 shadow-amber-500/15',
    ghost: 'bg-transparent text-slate-700 hover:bg-cream-100 hover:text-forest-800 focus:ring-forest-800 shadow-none',
    outline: 'bg-transparent border-2 border-forest-800 text-forest-800 hover:bg-forest-800 hover:text-white focus:ring-forest-800 shadow-none'
  };

  return (
    <button
      className={clsx(baseClasses, sizeClasses[size], variantClasses[variant], fullWidth && 'w-full', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
};
