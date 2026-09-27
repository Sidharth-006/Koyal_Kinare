import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { StockMovementType } from '@/lib/types';
import { ShoppingCart, Undo2 } from 'lucide-react';

export interface MovementTypeBadgeProps {
  type: StockMovementType | string;
  className?: string;
}

export const MovementTypeBadge: React.FC<MovementTypeBadgeProps> = ({ type, className }) => {
  switch (type) {
    case 'OPENING':
      return (
        <Badge variant="info" className={className}>
          Opening Stock
        </Badge>
      );
    case 'PURCHASE_RECEIPT':
      return (
        <Badge variant="forest" className={`gap-1 font-semibold ${className || ''}`}>
          <ShoppingCart className="w-3 h-3 text-forest-700 shrink-0" />
          <span>Purchase Receipt</span>
        </Badge>
      );
    case 'PURCHASE_REVERSAL':
      return (
        <Badge variant="danger" className={`gap-1 font-semibold border-rose-300 ${className || ''}`}>
          <Undo2 className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Purchase Reversal</span>
        </Badge>
      );
    case 'MANUAL_INCREASE':
      return (
        <Badge variant="success" className={className}>
          Manual Increase
        </Badge>
      );
    case 'MANUAL_DECREASE':
      return (
        <Badge variant="warning" className={className}>
          Manual Decrease
        </Badge>
      );
    case 'WASTAGE':
      return (
        <Badge variant="danger" className={className}>
          Wastage / Spoiled
        </Badge>
      );
    case 'MANUAL_CONSUMPTION':
      return (
        <Badge variant="warning" className={className}>
          Consumption
        </Badge>
      );
    case 'COUNT_CORRECTION':
      return (
        <Badge variant="neutral" className={className}>
          Count Correction
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className={className}>
          {type}
        </Badge>
      );
  }
};
