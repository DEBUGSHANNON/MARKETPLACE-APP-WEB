import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { ArrowUpRight, Loader2, MapPin, MessageSquare, Send, Sparkles } from 'lucide-react';
import { ChatMessage, Reservation } from '../types/marketplace';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import { requestAiChatSuggestions } from '../lib/aiClient';

interface MyMessagesViewProps {
  user: User | null;
  reservations: Reservation[];
  onSignIn: () => void;
  onBrowseCatalog: () => void;
  onOpenHandover: (reservation: Reservation, mode: 'seller' | 'buyer') => void;
  onNavigateReservations: () => void;
}

const QUICK_REPLIES = [
  'Hi! When are you free to meet on campus?',
  'Can we meet at PSZ Library?',
  'Let us meet at Arked Meranti.',
  'I am on my way now!',
];

const QUICK_EMOJIS = ['😊', '👍', '📍', '🤝', '⏰', '✅', '🙏'];

function formatTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '';
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate !== 'function') return '';
  return maybe.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const MyMessagesView: React.FC<MyMessagesViewProps> = ({
  user,
  reservations,
  onSignIn,
  onBrowseCatalog,
  onOpenHandover,
  onNavigateReservations,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | 'buying' | 'selling'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [aiReplies, setAiReplies] = useState<string[]>([]);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiError, setAiError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAiReplies([]);
    setAiError('');
  }, [selectedId]);

  const filteredConversations = useMemo(() => {
    if (!user) return [];
    return reservations.filter((r) => {
      if (roleFilter === 'buying') return r.buyerId === user.uid;
      if (roleFilter === 'selling') return r.sellerId === user.uid;
      return true;
    });
  }, [reservations, roleFilter, user]);

  const activeReservation = useMemo(() => {
    if (filteredConversations.length === 0) return null;
    return (
      filteredConversations.find((r) => r.id === selectedId) ||
      filteredConversations[0]
    );
  }, [filteredConversations, selectedId]);

  useEffect(() => {
    if (!activeReservation || !user) {
      setMessages([]);
      return;
    }

    setLoadingMsgs(true);
    const path = `reservations/${activeReservation.id}/messages`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChatMessage, 'id'>),
          })),
        );
        setLoadingMsgs(false);
      },
      (error) => {
        setLoadingMsgs(false);
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => unsub();
  }, [activeReservation, user]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-5 md:px-10 py-16 text-center">
        <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-10 shadow-sm">
          <p className="text-xs font-semibold text-[#659A73] uppercase tracking-wider mb-2">
            Buyer & Seller Inbox
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#112419] mb-3">
            Sign in to view{' '}
            <span className="font-display-serif italic font-normal text-utm-gradient">
              My Messages
            </span>
          </h1>
          <p className="text-sm text-[#4A5D50] max-w-md mx-auto mb-6">
            Chat directly with buyers and sellers once an item is reserved using your{' '}
            <span className="font-semibold text-[#0A462C]">@graduate.utm.my</span> student account.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] cursor-pointer"
          >
            Sign In with UTM Google (@graduate.utm.my)
          </button>
        </div>
      </div>
    );
  }

  const handleSend = async (customText?: string) => {
    const clean = (customText ?? text).trim();
    if (!clean || sending || !activeReservation) return;
    const path = `reservations/${activeReservation.id}/messages`;
    const senderName =
      user.displayName?.trim() || user.email?.split('@')[0] || 'UTM Student';

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
    if (!activeReservation || !user || aiSuggesting) return;
    const isBuyer = activeReservation.buyerId === user.uid;
    const counterpart = isBuyer
      ? activeReservation.sellerName
      : activeReservation.buyerName;
    setAiSuggesting(true);
    setAiError('');
    try {
      const res = await requestAiChatSuggestions({
        role: isBuyer ? 'buyer' : 'seller',
        listingTitle: activeReservation.listingTitle,
        listingPrice: activeReservation.listingPrice,
        handoverLocation: activeReservation.handoverLocation,
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
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold text-[#659A73] uppercase tracking-wider mb-2">
            Order Conversations
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#112419]">
            My{' '}
            <span className="font-display-serif italic font-normal text-utm-gradient">
              Messages
            </span>
          </h1>
        </div>

        <div className="inline-flex items-center gap-1 p-1 glass-surface border border-[#0A462C]/12 rounded-xl self-start">
          {(['all', 'buying', 'selling'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setRoleFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                roleFilter === tab
                  ? 'bg-[#0A462C] text-white'
                  : 'text-[#4A5D50] hover:text-[#0A462C]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredConversations.length === 0 ? (
        <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#DCE8D5] text-[#0A462C] flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-5 h-5" />
          </div>
          <p className="text-base font-bold text-[#112419]">
            No active order chats yet
          </p>
          <p className="text-sm text-[#4A5D50] mt-1 mb-6 max-w-md mx-auto">
            As soon as you reserve an object (or a buyer reserves your listing),
            a private chat thread opens here automatically.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="px-5 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Browse Campus Objects</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Thread List */}
          <div className="lg:col-span-4 space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredConversations.map((res) => {
              const isBuyer = res.buyerId === user.uid;
              const counterpart = isBuyer ? res.sellerName : res.buyerName;
              const isSelected = activeReservation?.id === res.id;
              return (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setSelectedId(res.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#0A462C]/40 shadow-md'
                      : 'glass-surface border-[#0A462C]/10 hover:bg-white/95'
                  }`}
                >
                  <img
                    src={resolveAssetUrl(res.listingImage)}
                    alt={res.listingTitle}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover bg-[#E3ECE0] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#659A73] font-semibold">
                      <span>{isBuyer ? 'Buying' : 'Selling'}</span>
                      <span className="font-mono-tabular text-[#0A462C]">
                        {formatMYR(res.listingPrice)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#112419] truncate mt-0.5">
                      {res.listingTitle}
                    </p>
                    <p className="text-xs text-[#4A5D50] truncate">
                      with {counterpart}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Live Chat Box */}
          {activeReservation && (
            <div className="lg:col-span-8 glass-surface border border-[#0A462C]/15 rounded-3xl shadow-sm flex flex-col h-[600px] overflow-hidden">
              <header className="px-5 py-4 bg-gradient-to-r from-[#0A462C] to-[#135E3E] text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={resolveAssetUrl(activeReservation.listingImage)}
                    alt={activeReservation.listingTitle}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/25"
                  />
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold truncate">
                      {activeReservation.buyerId === user.uid
                        ? `Seller: ${activeReservation.sellerName}`
                        : `Buyer: ${activeReservation.buyerName}`}
                    </h2>
                    <p className="text-xs text-white/80 truncate">
                      {activeReservation.listingTitle} ·{' '}
                      {formatMYR(activeReservation.listingPrice)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeReservation.status !== 'confirmed' && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenHandover(
                          activeReservation,
                          activeReservation.sellerId === user.uid
                            ? 'seller'
                            : 'buyer',
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Arrange Spot</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onNavigateReservations}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#0A462C] text-xs font-semibold hover:bg-[#F3F3EE] cursor-pointer"
                  >
                    Order Details
                  </button>
                </div>
              </header>

              <div
                ref={listRef}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F3F3EE]/70"
              >
                {loadingMsgs ? (
                  <p className="text-xs text-[#4A5D50] text-center py-8">
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <p className="text-sm font-semibold text-[#112419]">
                      Start coordinating your UTM campus handover
                    </p>
                    <p className="text-xs text-[#4A5D50]">
                      Tap a quick message below or write your own.
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
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-xs ${
                            mine
                              ? 'bg-[#0A462C] text-white rounded-br-sm'
                              : 'bg-white border border-[#0A462C]/10 text-[#112419] rounded-bl-sm'
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

              {/* Quick replies & emojis */}
              <div className="px-3.5 py-2 bg-white/90 border-t border-black/10 space-y-1.5">
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
                      className="px-2 py-0.5 text-sm rounded-md hover:bg-[#F3F3EE] cursor-pointer"
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
                className="p-3.5 bg-white flex items-center gap-2 border-t border-black/5"
              >
                <input
                  type="text"
                  maxLength={1000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F3F3EE] border border-black/10 text-sm text-[#112419]"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
