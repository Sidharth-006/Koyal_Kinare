import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { PurchaseStatus } from '@/lib/types';

export interface PurchaseStatusBadgeProps {
  status: PurchaseStatus | string;
  className?: string;
}

export const PurchaseStatusBadge: React.FC<PurchaseStatusBadgeProps> = ({ status, className }) => {
  switch (status) {
    case 'DRAFT':
      return (
        <Badge variant="warning" className={className}>
          Draft
        </Badge>
      );
    case 'RECEIVED':
      return (
        <Badge variant="success" className={className}>
          Received
        </Badge>
      );
    case 'REVERSED':
      return (
        <Badge variant="danger" className={className}>
          Reversed
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className={className}>
          {status}
        </Badge>
      );
  }
};
