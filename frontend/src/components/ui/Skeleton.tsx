import React from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={clsx('animate-pulse bg-cream-200/60 rounded-xl', className)} />
  );
};
