import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, ArrowUp, Zap, Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatStatus {
  tier: string;
  features: string[];
  daily: { used: number; limit: number | 'unlimited'; remaining: number | 'unlimited' };
}

const QUICK_PROMPTS = [
  'How many active jobs do I have?',
  'Summarize my top applicants',
  'What interviews are coming up?',
  'Show pipeline health overview',
];

export default function VealAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Load status when chat opens
  useEffect(() => {
    if (!open) return;
    api.get('/chat/status').then((res) => setStatus(res.data)).catch(() => {});
  }, [open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setRateLimited(false);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post('/chat', { message: trimmed, history });

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (status && typeof res.data.remaining === 'number') {
        setStatus((prev) => prev ? { ...prev, daily: { ...prev.daily, remaining: res.data.remaining, used: (typeof prev.daily.limit === 'number' ? prev.daily.limit : 0) - res.data.remaining } } : prev);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { error?: string; upgradeMessage?: string } } };
      if (errorObj.response?.status === 429) {
        setRateLimited(true);
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚡ You've reached your daily message limit. ${errorObj.response.data?.upgradeMessage || 'Upgrade your plan for more messages.'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Sorry, I couldn't process that request. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const tierLabel = status?.tier === 'ENTERPRISE' ? 'Enterprise' : status?.tier === 'PROFESSIONAL' ? 'Professional' : 'Starter';
  const tierColor = status?.tier === 'ENTERPRISE' ? 'text-amber-400' : status?.tier === 'PROFESSIONAL' ? 'text-blue-400' : 'text-vb-text-muted';

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand rounded-full shadow-lg shadow-brand/25 flex items-center justify-center hover:bg-brand-dark hover:scale-105 active:scale-95 transition-all group"
          title="Chat with VealAI"
        >
          <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh] bg-vb-surface border border-vb-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-vb-border bg-vb-card">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="text-vb-text font-semibold text-sm">VealAI</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-brand rounded-full" />
                  <span className="text-vb-text-muted text-[11px]">
                    Online · <span className={tierColor}>{tierLabel}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status && status.daily.limit !== 'unlimited' && (
                <span className="text-[10px] text-vb-text-faint bg-vb-bg px-2 py-0.5 rounded-full">
                  {status.daily.remaining}/{status.daily.limit}
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-vb-text-secondary hover:text-vb-text hover:bg-vb-bg rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-brand" />
                </div>
                <h4 className="text-vb-text font-semibold mb-1">Hi! I'm VealAI</h4>
                <p className="text-vb-text-muted text-sm mb-6 leading-relaxed">
                  Your intelligent recruitment assistant. I can help with your jobs, applicants, analytics, and more.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-3.5 py-2.5 bg-vb-card border border-vb-border rounded-xl text-sm text-vb-text-secondary hover:text-vb-text hover:border-brand/30 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-brand text-white rounded-br-md'
                        : 'bg-vb-card border border-vb-border text-vb-text rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-vb-card border border-vb-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-brand animate-spin" />
                  <span className="text-vb-text-muted text-sm">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Rate Limit Banner */}
          {rateLimited && (
            <div className="mx-4 mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-500">Daily limit reached.</span>
              <button className="ml-auto text-xs text-brand font-medium flex items-center gap-1 hover:underline">
                <Zap className="w-3 h-3" /> Upgrade
              </button>
            </div>
          )}

          {/* Tier Badge (Starter only) */}
          {status?.tier === 'STARTER' && !rateLimited && messages.length > 0 && (
            <div className="mx-4 mb-2 px-3 py-1.5 bg-vb-card border border-vb-border rounded-lg flex items-center justify-between">
              <span className="text-[11px] text-vb-text-faint">
                Starter Plan · {typeof status.daily.remaining === 'number' ? status.daily.remaining : 0} messages left today
              </span>
              <button className="text-[11px] text-brand font-medium flex items-center gap-0.5 hover:underline">
                <ArrowUp className="w-3 h-3" /> Upgrade
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="px-4 pb-4 pt-2 border-t border-vb-border">
            <div className="flex items-end gap-2 bg-vb-card border border-vb-border rounded-xl px-3 py-2 focus-within:border-brand/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={rateLimited ? 'Upgrade to continue chatting...' : 'Ask VealAI anything...'}
                disabled={rateLimited || loading}
                rows={1}
                className="flex-1 bg-transparent text-sm text-vb-text placeholder:text-vb-text-muted resize-none outline-none max-h-24 disabled:opacity-50"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading || rateLimited}
                className="p-1.5 bg-brand text-white rounded-lg disabled:opacity-30 hover:bg-brand-dark transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-[10px] text-vb-text-faint mt-2">
              VealAI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
