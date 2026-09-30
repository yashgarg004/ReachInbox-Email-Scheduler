import { useEffect, useState, useCallback } from 'react';
import { Search, Plus } from 'lucide-react';
import { getScheduledEmails, getSentEmails, searchEmails, getEmailStats, cancelEmail } from '../services/api';
import EmailTable from '../components/EmailTable';
import ComposeModal from '../components/ComposeModal';
import EmailDetail from '../components/EmailDetail';
import toast from 'react-hot-toast';
import { Email } from '../types';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [stats, setStats] = useState({ scheduled: 0, sent: 0, failed: 0 });
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const fetchStats = async () => {
    try {
      const data = await getEmailStats();
      setStats(data);
    } catch (e) {
      // shrug
    }
  };

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const data = await searchEmails(searchQuery);
        setEmails(data.emails || data || []);
        setTotalPages(1);
      } else {
        const data = activeTab === 'scheduled' 
          ? await getScheduledEmails(page)
          : await getSentEmails(page);
        setEmails(data.emails || data || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, searchQuery]);

  useEffect(() => {
    fetchStats();
    fetchEmails();

    // auto refresh
    const interval = setInterval(() => {
      fetchStats();
      fetchEmails();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchEmails]);

  // debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchEmails();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this email?')) return;
    try {
      await cancelEmail(id);
      toast.success('Email canceled');
      fetchEmails();
      fetchStats();
    } catch(e) {
      toast.error('Failed to cancel');
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
      
      {/* Toolbar Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
        {/* Tabs */}
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab('scheduled'); setPage(1); setSelectedEmail(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'scheduled' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => { setActiveTab('sent'); setPage(1); setSelectedEmail(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'sent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sent
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Compose */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 shadow-sm whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </button>
        </div>
      </div>

      {/* Stats dots row */}
      <div className="flex items-center space-x-6 mb-4 px-1">
        <div className="flex items-center text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
          <span className="text-gray-500">Scheduled: <strong className="text-gray-900">{stats.scheduled}</strong></span>
        </div>
        <div className="flex items-center text-sm">
          <span className="w-2 h-2 rounded-full bg-brand-500 mr-2"></span>
          <span className="text-gray-500">Sent: <strong className="text-gray-900">{stats.sent}</strong></span>
        </div>
        <div className="flex items-center text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
          <span className="text-gray-500">Failed: <strong className="text-gray-900">{stats.failed}</strong></span>
        </div>
      </div>

      {/* Main content area with optional side panel */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Email List */}
        <div className={`bg-white shadow rounded-lg border border-gray-200 overflow-hidden ${selectedEmail ? 'flex-1' : 'w-full'}`}>
          <EmailTable 
            emails={emails}
            loading={loading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onCancel={activeTab === 'scheduled' ? handleCancel : undefined}
            onSelect={(em) => setSelectedEmail(em)}
          />
        </div>

        {/* Detail panel */}
        {selectedEmail && (
          <div className="w-96 bg-white border-l border-gray-200 ml-0 hidden lg:block shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] rounded-r-lg">
            <EmailDetail email={selectedEmail} onClose={() => setSelectedEmail(null)} />
          </div>
        )}
      </div>

      {isComposeOpen && (
        <ComposeModal onClose={() => {
          setIsComposeOpen(false);
          fetchEmails();
          fetchStats();
        }} />
      )}
    </div>
  );
}
