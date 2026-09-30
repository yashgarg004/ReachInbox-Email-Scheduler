import { Email } from '../types';
import StatusBadge from './StatusBadge';
import { format } from 'date-fns';
import { Trash2, Mail } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  emails: Email[];
  loading: boolean;
  onCancel?: (id: string) => void;
  onSelect?: (email: Email) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

// pick a bg color for the avatar based on first char
const avatarColors = [
  'bg-brand-100 text-brand-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];
function getAvatarColor(str: string) {
  const idx = str.charCodeAt(0) % avatarColors.length;
  return avatarColors[idx];
}

export default function EmailTable({ emails, loading, onCancel, onSelect, page, totalPages, onPageChange }: Props) {
  // loading skeleton
  if (loading && emails.length === 0) {
    return (
      <div className="divide-y divide-gray-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center px-6 py-4 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-gray-200 mr-4"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div className="h-3 bg-gray-200 rounded w-16 ml-4"></div>
          </div>
        ))}
      </div>
    );
  }

  // empty state
  if (emails.length === 0) {
    return (
      <div className="py-16 text-center">
        <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">No emails found</p>
        <p className="text-gray-400 text-xs mt-1">Schedule some emails to see them here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* email rows */}
      <div className="divide-y divide-gray-100">
        {emails.map((em) => (
          <div 
            key={em.id}
            onClick={() => onSelect?.(em)}
            className="flex items-center px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors group"
          >
            {/* avatar circle */}
            <div className="flex-shrink-0 mr-4">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-medium text-sm ${getAvatarColor(em.recipientEmail)}`}>
                {em.recipientEmail.charAt(0).toUpperCase()}
              </div>
            </div>
            
            {/* main info */}
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-sm font-medium text-gray-900 truncate">
                {em.recipientEmail}
              </p>
              <div className="flex text-sm">
                <span className={`truncate mr-2 ${em.status === 'FAILED' ? 'text-red-600' : 'text-gray-700'}`}>
                  {em.subject}
                </span>
                {em.body && (
                  <span className="text-gray-400 truncate hidden sm:inline">
                    — {em.body.substring(0, 60)}
                  </span>
                )}
              </div>
            </div>
            
            {/* right side meta */}
            <div className="flex-shrink-0 flex items-center space-x-4">
              <div className="flex flex-col items-end space-y-1">
                <span className="text-xs text-gray-400">
                  {format(new Date(em.scheduledAt), 'MMM d, yyyy')}
                </span>
                <StatusBadge status={em.status} />
              </div>
              
              {/* cancel button for scheduled */}
              {onCancel && ['SCHEDULED', 'QUEUED'].includes(em.status) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onCancel(em.id); }}
                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                  title="Cancel"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <button 
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50 bg-white hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button 
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50 bg-white hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
