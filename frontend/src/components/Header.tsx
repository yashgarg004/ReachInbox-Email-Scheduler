import { useEffect, useState } from 'react';
import { Mail, LogOut, MessageSquare, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getSlackStatus, disconnectSlack } from '../services/api';
import toast from 'react-hot-toast';

export default function Header() {
  const { user, logout } = useAuth();
  const [slack, setSlack] = useState({ connected: false, teamName: '' });

  useEffect(() => {
    if (user) {
      getSlackStatus()
        .then(data => setSlack(data))
        .catch(() => {}); // quiet fail
    }
  }, [user]);

  const handleSlackConnect = () => {
    window.location.href = '/api/slack/connect';
  };

  const handleSlackDisconnect = async () => {
    try {
      await disconnectSlack();
      setSlack({ connected: false, teamName: '' });
      toast.success('Disconnected from Slack');
    } catch (e) {
      toast.error('Failed to disconnect Slack');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 sticky top-0 z-10">
      {/* brand */}
      <div className="flex items-center space-x-2 text-brand-600">
        <Mail className="w-5 h-5" />
        <span className="font-bold text-lg">ReachInbox</span>
      </div>

      {/* right side */}
      <div className="flex items-center space-x-4">
        {/* slack connect */}
        {slack.connected ? (
          <div className="flex items-center text-sm text-gray-600 space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Slack</span>
            <button onClick={handleSlackDisconnect} className="text-xs text-red-500 hover:underline">
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={handleSlackConnect}
            className="flex items-center text-sm text-gray-500 hover:text-gray-800 font-medium"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Connect Slack
          </button>
        )}

        <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

        <div className="flex items-center space-x-3">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="hidden md:block">
            <div className="text-sm font-medium text-gray-700">{user?.name || 'User'}</div>
            <div className="text-xs text-gray-400">{user?.email}</div>
          </div>
          <button 
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
