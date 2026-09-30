import { X, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { Email } from '../types';
import { format } from 'date-fns';

interface Props {
  email: Email;
  onClose: () => void;
}

export default function EmailDetail({ email, onClose }: Props) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center space-x-3 truncate mr-4">
          <StatusBadge status={email.status} />
          <h2 className="text-sm font-medium text-gray-900 truncate">
            {email.recipientEmail}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 p-1 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-3">
            {email.subject}
          </h3>
          
          <div className="flex flex-col space-y-2 text-sm text-gray-500">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-2 text-gray-400" />
              Scheduled: {format(new Date(email.scheduledAt), 'MMM d, yyyy HH:mm')}
            </span>
            
            {email.status === 'SENT' && email.sentAt && (
              <span className="flex items-center text-brand-600">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Sent: {format(new Date(email.sentAt), 'MMM d, yyyy HH:mm')}
              </span>
            )}
            
            {email.status === 'FAILED' && (
              <span className="flex items-center text-red-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                Failed to deliver
              </span>
            )}

            <span className="text-xs text-gray-400">
              From: {email.senderEmail}
            </span>
          </div>
        </div>

        {/* email body */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[200px] text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {email.body}
        </div>
      </div>
    </div>
  );
}
