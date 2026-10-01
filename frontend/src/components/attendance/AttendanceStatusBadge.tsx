'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { AttendanceStatus } from '@/lib/types';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus | null | undefined;
  className?: string;
}

export const AttendanceStatusBadge: React.FC<AttendanceStatusBadgeProps> = ({
  status,
  className
}) => {
  if (!status) {
    return (
      <Badge variant="neutral" className={className}>
        Unrecorded
      </Badge>
    );
  }

  switch (status) {
    case 'PRESENT':
      return (
        <Badge variant="success" className={className}>
          Present
        </Badge>
      );
    case 'HALF_DAY':
      return (
        <Badge variant="info" className={className}>
          Half Day
        </Badge>
      );
    case 'ABSENT':
      return (
        <Badge variant="danger" className={className}>
          Absent
        </Badge>
      );
    case 'LEAVE':
      return (
        <Badge variant="warning" className={className}>
          Leave
        </Badge>
      );
    case 'OFF_DAY':
      return (
        <Badge variant="neutral" className={className}>
          Off Day
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
