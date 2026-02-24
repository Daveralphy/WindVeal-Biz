import { useState, useEffect } from 'react';
import { Mail, Send, Inbox, Clock } from 'lucide-react';
import api from '@/lib/api';

interface EmailItem {
  id: string;
  to: string;
  subject: string;
  status: string;
  sentAt: string;
  openedAt: string | null;
}

interface CommsData {
  stats: { sent: number; opened: number; scheduled: number };
  emails: EmailItem[];
}

const STAT_CONFIG = [
  { key: 'sent', label: 'Sent', icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'opened', label: 'Opened', icon: Inbox, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'scheduled', label: 'Scheduled', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
] as const;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function Communications() {
  const [data, setData] = useState<CommsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/communications').then((res) => setData(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Communications</h1>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl h-20 border border-vb-border animate-pulse" />
          ))}
        </div>
        <div className="bg-vb-surface border border-vb-border rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Communications</h1>
        <button className="px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
          + Compose Email
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="bg-vb-card border border-vb-border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-white text-lg font-bold">{data.stats[key]}</p>
              <p className="text-gray-500 text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-vb-surface border border-vb-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-vb-border">
          <h2 className="text-white text-sm font-medium">Recent Emails</h2>
        </div>
        <div className="divide-y divide-vb-border">
          {data.emails.map((email) => (
            <div key={email.id} className="px-4 py-3 flex items-center justify-between hover:bg-vb-card/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">{email.to}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${email.status === 'sent' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {email.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">{email.subject}</p>
                </div>
              </div>
              <span className="text-gray-600 text-xs">{timeAgo(email.sentAt)}</span>
            </div>
          ))}
          {data.emails.length === 0 && (
            <p className="px-4 py-8 text-gray-500 text-sm text-center">No emails sent yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
