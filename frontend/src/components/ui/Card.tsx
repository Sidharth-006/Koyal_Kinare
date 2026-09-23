import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, hoverable = false, ...props }) => {
  return (
    <div
      className={clsx(
        'bg-white border border-border rounded-2xl p-5 md:p-6 shadow-card text-slate-800 transition-all duration-200',
        hoverable && 'hover:shadow-card-hover hover:-translate-y-0.5 hover:border-forest-800/30 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
