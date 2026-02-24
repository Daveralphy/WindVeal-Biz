import { useState, useEffect } from 'react';
import { Calendar, Clock, Video, User, MapPin, MoreHorizontal, Phone } from 'lucide-react';
import api from '@/lib/api';

interface Interview {
  id: string;
  candidateName: string;
  jobTitle: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  meetingLink: string | null;
  status: string;
  interviewer: string;
}

const TYPE_ICONS: Record<string, typeof Video> = {
  VIDEO: Video,
  IN_PERSON: MapPin,
  PHONE_SCREEN: Phone,
  TECHNICAL: Clock,
  PANEL: Clock,
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  NO_SHOW: 'bg-gray-500/10 text-gray-400',
  RESCHEDULED: 'bg-amber-500/10 text-amber-400',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d >= today && d < tomorrow) return 'Today';
  if (d >= tomorrow && d < dayAfter) return 'Tomorrow';
  if (d >= yesterday && d < today) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function Interviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/interviews').then((res) => setInterviews(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayInterviews = interviews.filter((i) => {
    const d = new Date(i.scheduledAt);
    return d >= today && d < tomorrow && i.status === 'SCHEDULED';
  });
  const upcomingInterviews = interviews.filter((i) => {
    const d = new Date(i.scheduledAt);
    return d >= tomorrow && i.status === 'SCHEDULED';
  });
  const pastInterviews = interviews.filter(
    (i) => i.status === 'COMPLETED' || i.status === 'CANCELLED' || new Date(i.scheduledAt) < today
  );

  const renderCard = (interview: Interview) => {
    const TypeIcon = TYPE_ICONS[interview.type] || Video;
    return (
      <div
        key={interview.id}
        className="bg-vb-card border border-vb-border rounded-xl p-4 hover:border-vb-muted transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-vb-muted flex items-center justify-center">
              <User className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <h3 className="text-white text-sm font-medium">
                {interview.candidateName}
              </h3>
              <p className="text-gray-500 text-xs">{interview.jobTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[interview.status] || ''}`}
            >
              {interview.status.toLowerCase().replace('_', ' ')}
            </span>
            <button className="text-gray-500 hover:text-white">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(interview.scheduledAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(interview.scheduledAt)} · {interview.durationMinutes} min
          </span>
          <span className="flex items-center gap-1">
            <TypeIcon className="w-3.5 h-3.5" />
            {interview.type.toLowerCase().replace('_', ' ')}
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-vb-border flex items-center justify-between">
          <span className="text-gray-500 text-xs">
            Interviewer: {interview.interviewer}
          </span>
          {interview.status === 'SCHEDULED' && interview.meetingLink && (
            <button className="text-brand text-xs hover:text-brand-light">
              Join Meeting
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Interviews</h1>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl h-36 border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Interviews</h1>
        <button className="px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
          + Schedule Interview
        </button>
      </div>

      {/* Today */}
      {todayInterviews.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Today</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {todayInterviews.map(renderCard)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingInterviews.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Upcoming</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {upcomingInterviews.map(renderCard)}
          </div>
        </div>
      )}

      {/* Past */}
      {pastInterviews.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Past</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pastInterviews.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
