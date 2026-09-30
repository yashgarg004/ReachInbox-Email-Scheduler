import React from 'react';

type StatusType = 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

interface StatusBadgeProps {
  status: StatusType | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'SCHEDULED': return 'bg-amber-500';
      case 'QUEUED': return 'bg-blue-500';
      case 'SENDING': return 'bg-indigo-500 animate-pulse';
      case 'SENT': return 'bg-brand-500';
      case 'FAILED': return 'bg-red-500';
      case 'RATE_LIMITED': return 'bg-orange-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusText = () => {
    return status.replace('_', ' ').toLowerCase();
  };

  return (
    <div className="relative group flex items-center justify-center">
      <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor()}`} />
      
      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <span className="capitalize">{getStatusText()}</span>
        {/* little triangle */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
}
