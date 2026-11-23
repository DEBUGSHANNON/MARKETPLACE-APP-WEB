import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { motion } from 'motion/react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { ChatMessage, Reservation } from '../types/marketplace';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import { requestAiChatSuggestions } from '../lib/aiClient';

interface ChatModalProps {
  reservation: Reservation | null;
  user: User | null;
  onClose: () => void;
  justReserved?: boolean;
}

const QUICK_REPLIES = [
  'Hi! I just reserved this. When are you free to meet?',
  'Can we meet at PSZ Library?',
  'Let us meet at Arked Meranti.',
  'Is DuitNow QR or cash okay?',
];

const QUICK_EMOJIS = ['😊', '👍', '📍', '🤝', '⏰', '✅', '🙏'];

function formatTimestamp(ts: unknown): string {
  if (!ts) return '';
  if (ts instanceof Date) {
    return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (typeof ts === 'object') {
    const maybe = ts as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return '';
}

export const ChatModal: React.FC<ChatModalProps> = ({
  reservation,
  user,
  onClose,
  justReserved = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiReplies, setAiReplies] = useState<string[]>([]);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiError, setAiError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const isShowcasePreview = Boolean(reservation?.id.startsWith('showcase-'));

  useEffect(() => {
    setAiReplies([]);
    setAiError('');
  }, [reservation?.id]);

  useEffect(() => {
    if (!reservation || !user) return;
    if (isShowcasePreview) {
      setMessages([
        {
          id: 'showcase-greeting',
          senderId: reservation.sellerId,
          senderName: reservation.sellerName,
          text: `Hi! Thanks for reserving "${reservation.listingTitle}". Let me know where on UTM campus works best for pickup!`,
          createdAt: new Date(),
        },
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = `reservations/${reservation.id}/messages`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        setMessages(items);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => unsub();
  }, [reservation, user, isShowcasePreview]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  if (!reservation || !user) return null;

  const isBuyer = reservation.buyerId === user.uid;
  const counterpart = isBuyer ? reservation.sellerName : reservation.buyerName;

  const handleSend = async (customText?: string) => {
    const clean = (customText ?? text).trim();
    if (!clean || sending) return;

    const senderName =
      user.displayName?.trim() || user.email?.split('@')[0] || 'UTM Student';

    if (isShowcasePreview) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderId: user.uid,
          senderName,
          text: clean.slice(0, 1000),
          createdAt: new Date(),
        },
      ]);
      if (!customText) setText('');
      return;
    }

    const path = `reservations/${reservation.id}/messages`;
    setSending(true);
    try {
      await addDoc(collection(db, path), {
        senderId: user.uid,
        senderName: senderName.slice(0, 60),
        text: clean.slice(0, 1000),
        createdAt: serverTimestamp(),
      });
      if (!customText) setText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setSending(false);
    }
  };

  const handleSuggestReplies = async () => {
    if (aiSuggesting) return;
    setAiSuggesting(true);
    setAiError('');
    try {
      const res = await requestAiChatSuggestions({
        role: isBuyer ? 'buyer' : 'seller',
        listingTitle: reservation.listingTitle,
        listingPrice: reservation.listingPrice,
        handoverLocation: reservation.handoverLocation,
        recentMessages: messages.slice(-6).map((m) => ({
          sender: m.senderId === user.uid ? 'Me' : counterpart,
          text: m.text,
        })),
      });
      setAiReplies(res.suggestions || []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not suggest replies.');
    } finally {
      setAiSuggesting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-modal-title"
      className="fixed inset-0 z-50 bg-[#0E2417]/40 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-white/95 backdrop-blur-xl border border-white/70 rounded-3xl w-full max-w-lg h-[min(660px,88dvh)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 bg-gradient-to-r from-[#0A462C] to-[#135E3E] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={resolveAssetUrl(reservation.listingImage)}
              alt={reservation.listingTitle}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/25"
            />
            <div className="min-w-0">
              <h2 id="chat-modal-title" className="text-base font-bold truncate">
                Chat with {counterpart}
              </h2>
              <p className="text-xs text-white/85 truncate mt-0.5">
                {reservation.listingTitle} · {formatMYR(reservation.listingPrice)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {justReserved && (
          <div className="px-4 py-2.5 bg-[#DCE8D5]/80 border-b border-[#0A462C]/15 text-xs text-[#0A462C] font-semibold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isShowcasePreview
                ? 'Showcase order preview reserved — try sending a message below!'
                : 'Order reserved! Message the seller below to coordinate your UTM campus pickup.'}
            </span>
          </div>
        )}

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F3F3EE]/85"
        >
          {loading ? (
            <p className="text-xs text-[#4A5D50] text-center py-8">
              Loading conversation...
            </p>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 space-y-1.5">
              <p className="text-sm font-semibold text-[#112419]">
                Order reserved — start the conversation!
              </p>
              <p className="text-xs text-[#4A5D50]">
                Tap a quick reply below or write a message to coordinate pickup.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const mine = msg.senderId === user.uid;
              const timeStr = formatTimestamp(msg.createdAt);
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-xs ${
                      mine
                        ? 'bg-[#0A462C] text-white rounded-br-sm'
                        : 'bg-white border border-black/10 text-[#112419] rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {timeStr && (
                    <span className="text-[10px] text-[#4A5D50] mt-1 px-1 font-mono-tabular">
                      {timeStr}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-3.5 pt-2.5 pb-1.5 bg-white border-t border-black/10 space-y-1.5">
          {aiError && (
            <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
              {aiError}
            </p>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              disabled={aiSuggesting}
              onClick={() => void handleSuggestReplies()}
              className="px-2.5 py-1 rounded-lg bg-[#0A462C] text-white text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1 hover:bg-[#0E5D3B] disabled:opacity-55 cursor-pointer"
            >
              {aiSuggesting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span>{aiSuggesting ? 'Drafting...' : 'AI Reply'}</span>
            </button>

            {(aiReplies.length > 0 ? aiReplies : QUICK_REPLIES).map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={sending}
                onClick={() => void handleSend(reply)}
                className="px-2.5 py-1 rounded-lg bg-[#DCE8D5]/70 hover:bg-[#DCE8D5] text-[11px] font-semibold text-[#0A462C] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setText((prev) => `${prev}${emoji}`)}
                className="px-2 py-0.5 text-base rounded-lg hover:bg-[#F3F3EE] cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="p-3 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message about pickup time or spot..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F3F3EE] border border-black/10 text-base sm:text-sm text-[#112419]"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="Send message"
            className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};
