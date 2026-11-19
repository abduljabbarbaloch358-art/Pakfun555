import { useState } from 'react';
import { Headphones, Send, MessageSquare } from 'lucide-react';
import { SupportTicket } from '../types/platform';

interface Props {
  tickets: SupportTicket[];
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onCreateTicket: (params: {
    subject: string;
    category: SupportTicket['category'];
    message: string;
  }) => Promise<boolean | undefined>;
  onReplyTicket: (ticket: SupportTicket, text: string) => Promise<boolean | undefined>;
}

export function SupportView({
  tickets,
  isSignedIn,
  onRequireAuth,
  onCreateTicket,
  onReplyTicket,
}: Props) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('Deposit');
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const activeTicket = tickets.find((t) => t.id === selectedId) || tickets[0] || null;

  const handleOpenTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (!subject.trim() || !message.trim()) return;
    const ok = await onCreateTicket({ subject: subject.trim(), category, message: message.trim() });
    if (ok) {
      setSubject('');
      setMessage('');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    await onReplyTicket(activeTicket, replyText.trim());
    setReplyText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Create Ticket */}
      <form
        onSubmit={handleOpenTicket}
        className="lg:col-span-5 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 h-fit"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
          <Headphones className="w-5 h-5 text-[#19B954]" />
          <div>
            <h2 className="text-lg font-bold text-white">24/7 Customer Support</h2>
            <p className="text-xs text-[#A3B3AC]">Direct priority desk for payments, KYC & security</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#A3B3AC]">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
          >
            <option value="Deposit">Deposit</option>
            <option value="Withdrawal">Withdrawal</option>
            <option value="KYC">KYC</option>
            <option value="Game Issue">Game Issue</option>
            <option value="Account Security">Account Security</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#A3B3AC]">Subject</label>
          <input
            type="text"
            required
            placeholder="Brief summary of your inquiry"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#A3B3AC]">Message</label>
          <textarea
            rows={4}
            required
            placeholder="Include transaction reference ID or table round number if applicable..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white font-semibold text-sm cursor-pointer"
        >
          Submit Support Ticket
        </button>
      </form>

      {/* Active Ticket Conversation */}
      <div className="lg:col-span-7 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#19B954]" />
            <h3 className="text-base font-bold text-white">Your Tickets ({tickets.length})</h3>
          </div>
          {tickets.length > 1 && (
            <select
              value={activeTicket?.id || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-[#101413] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subject} ({t.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {!activeTicket ? (
          <div className="py-16 text-center text-xs text-[#A3B3AC]">
            No active support tickets. Open a ticket on the left to chat with our 24/7 specialists.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs bg-[#101413] border border-white/10 rounded-xl px-4 py-2.5">
              <span className="font-semibold text-white">
                {activeTicket.subject} · {activeTicket.category}
              </span>
              <span
                className={`font-semibold capitalize ${
                  activeTicket.status === 'resolved' ? 'text-[#19B954]' : 'text-[#F5B82E]'
                }`}
              >
                {activeTicket.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] pr-1">
              {activeTicket.messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-xs max-w-[85%] ${
                    m.sender === 'agent'
                      ? 'bg-[#19B954]/15 border border-[#19B954]/30 text-white mr-auto'
                      : 'bg-[#202825] text-white ml-auto'
                  }`}
                >
                  <div className="text-[10px] text-[#A3B3AC] mb-1">
                    {m.senderName} · {new Date(m.sentAt).toLocaleTimeString()}
                  </div>
                  <p className="leading-relaxed">{m.text}</p>
                </div>
              ))}
            </div>

            {activeTicket.status !== 'resolved' && (
              <form onSubmit={handleReply} className="flex gap-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  placeholder="Write a follow-up message..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
