import React from 'react';
import { Mail } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-64">
      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
        <Mail className="w-8 h-8 text-brand-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">No emails found</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        It looks like there aren't any emails in this view yet. 
        When you send or schedule emails, they'll appear right here.
      </p>
    </div>
  );
}
