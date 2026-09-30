import { useState, useRef } from 'react';
import { 
  X, Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Link, Image as ImageIcon, Code,
  UploadCloud, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scheduleBatch, scheduleEmail } from '../services/api';

export default function ComposeModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delay, setDelay] = useState(30);
  const [limit, setLimit] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [emailCount, setEmailCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      toast.error('Only CSV files please');
      return;
    }
    setFile(f);
    // quick count of lines to estimate email count
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.includes('@'));
      setEmailCount(lines.length);
    };
    reader.readAsText(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender || !subject || !scheduledAt) {
      toast.error('Fill in sender, subject, and schedule time');
      return;
    }
    setSubmitting(true);

    try {
      if (mode === 'bulk') {
        if (!file) { toast.error('Upload a CSV file'); setSubmitting(false); return; }
        const formData = new FormData();
        formData.append('csv', file);
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('scheduledAt', new Date(scheduledAt).toISOString());
        formData.append('delayBetween', String(delay * 1000));
        formData.append('hourlyLimit', String(limit));
        formData.append('senderEmail', sender);
        await scheduleBatch(formData);
        toast.success(`${emailCount} emails scheduled!`);
      } else {
        if (!recipient) { toast.error('Enter recipient email'); setSubmitting(false); return; }
        await scheduleEmail({
          recipientEmail: recipient,
          subject,
          body,
          senderEmail: sender,
          scheduledAt: new Date(scheduledAt).toISOString()
        });
        toast.success('Email scheduled!');
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* overlay */}
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* modal card */}
        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
          
          {/* header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Compose New Email</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* body */}
          <div className="px-6 py-5">
            {/* mode toggle */}
            <div className="flex mb-6 space-x-2">
              <button
                onClick={() => setMode('single')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  mode === 'single' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Single
              </button>
              <button
                onClick={() => setMode('bulk')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  mode === 'bulk' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Bulk CSV
              </button>
            </div>

            <form id="compose-form" onSubmit={handleSubmit} className="space-y-4">
              {/* From */}
              <div className="flex items-center">
                <label className="w-16 text-sm font-medium text-gray-700">From:</label>
                <input
                  required
                  type="email"
                  value={sender}
                  onChange={e => setSender(e.target.value)}
                  className="flex-1 border-0 border-b border-gray-200 focus:ring-0 focus:border-brand-500 sm:text-sm py-2 px-0 bg-transparent"
                  placeholder="you@company.com"
                />
              </div>

              {/* To */}
              <div className="flex items-center">
                <label className="w-16 text-sm font-medium text-gray-700">To:</label>
                {mode === 'single' ? (
                  <input
                    required
                    type="email"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    className="flex-1 border-0 border-b border-gray-200 focus:ring-0 focus:border-brand-500 sm:text-sm py-2 px-0 bg-transparent"
                    placeholder="recipient@example.com"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-between py-1 border-b border-gray-200">
                    <div className="text-sm">
                      {file ? (
                        <span className="text-brand-600 font-medium flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          {file.name} ({emailCount} emails detected)
                        </span>
                      ) : (
                        <span className="text-gray-400">Upload a CSV with email addresses</span>
                      )}
                    </div>
                    <input type="file" ref={fileRef} className="hidden" accept=".csv" onChange={handleFileChange} />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-brand-700 bg-brand-100 hover:bg-brand-200"
                    >
                      <UploadCloud className="w-3 h-3 mr-1" />
                      Upload CSV
                    </button>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="flex items-center">
                <label className="w-16 text-sm font-medium text-gray-700">Subject:</label>
                <input
                  required
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="flex-1 border-0 border-b border-gray-200 focus:ring-0 focus:border-brand-500 sm:text-sm py-2 px-0 bg-transparent"
                  placeholder="Enter subject here"
                />
              </div>

              {/* Schedule config row */}
              <div className="flex flex-col sm:flex-row sm:space-x-4 pt-2">
                <div className="flex-1 flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Start Time</label>
                  <input 
                    required
                    type="datetime-local" 
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                  />
                </div>
                {mode === 'bulk' && (
                  <>
                    <div className="flex-1 flex flex-col mt-3 sm:mt-0">
                      <label className="text-xs text-gray-500 mb-1">Delay (seconds)</label>
                      <input 
                        type="number" 
                        min={1}
                        value={delay}
                        onChange={e => setDelay(Number(e.target.value))}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                      />
                    </div>
                    <div className="flex-1 flex flex-col mt-3 sm:mt-0">
                      <label className="text-xs text-gray-500 mb-1">Hourly Limit</label>
                      <input 
                        type="number" 
                        min={1}
                        value={limit}
                        onChange={e => setLimit(Number(e.target.value))}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* rich text toolbar (decorative) */}
              <div className="border border-gray-300 rounded-md overflow-hidden mt-6">
                <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 flex items-center space-x-1 flex-wrap">
                  <button type="button" className="toolbar-btn"><Bold className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><Italic className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><Underline className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><Strikethrough className="w-4 h-4" /></button>
                  <div className="toolbar-divider"></div>
                  <button type="button" className="toolbar-btn"><AlignLeft className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><AlignCenter className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><AlignRight className="w-4 h-4" /></button>
                  <div className="toolbar-divider"></div>
                  <button type="button" className="toolbar-btn"><List className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><ListOrdered className="w-4 h-4" /></button>
                  <div className="toolbar-divider"></div>
                  <button type="button" className="toolbar-btn"><Link className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><ImageIcon className="w-4 h-4" /></button>
                  <button type="button" className="toolbar-btn"><Code className="w-4 h-4" /></button>
                </div>
                
                <textarea
                  required
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full border-0 focus:ring-0 resize-y min-h-[200px] p-4 text-sm"
                  placeholder="Type your message here..."
                ></textarea>
              </div>
            </form>
          </div>

          {/* footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              form="compose-form"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
