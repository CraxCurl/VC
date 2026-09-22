'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types/meeting';
import { X, Send, Smile, MessageSquare } from 'lucide-react';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId: string;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👋', '🙌', '✨'];

export function ChatDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
}: ChatDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs sm:hidden animate-in fade-in"
      />
      <div className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-96 max-w-full bg-[#202124] border-l border-[#3c4043] flex flex-col shadow-2xl transition-all animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#3c4043]">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#8ab4f8]" />
            <h2 className="text-white font-medium text-base sm:text-lg">In-call messages</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice info */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#282a2d] border-b border-[#3c4043]/60 text-[11px] sm:text-xs text-[#9aa0a6]">
          Messages are sent directly peer-to-peer and are deleted when the call ends.
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 sm:space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#9aa0a6] px-4">
              <div className="w-12 h-12 rounded-full bg-[#303134] flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-[#8ab4f8]" />
              </div>
              <p className="font-medium text-sm text-[#e8eaed]">No messages yet</p>
              <p className="text-xs mt-1">Send a message to start chatting with your friend.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] sm:text-xs font-semibold text-[#8ab4f8]">
                    {msg.isSelf ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[10px] text-[#9aa0a6]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm break-words ${
                    msg.isSelf
                      ? 'bg-[#1a73e8] text-white rounded-tr-xs'
                      : 'bg-[#303134] text-[#e8eaed] rounded-tl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Emojis bar */}
        {showEmojiPicker && (
          <div className="px-3 sm:px-4 py-2 bg-[#282a2d] border-t border-[#3c4043] flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-lg sm:text-xl p-1 sm:p-1.5 hover:bg-[#3c4043] rounded-lg transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Input Box */}
        <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-[#3c4043] bg-[#202124]">
          <div className="flex items-center gap-2 bg-[#303134] rounded-full px-3.5 sm:px-4 py-1.5 focus-within:ring-2 focus-within:ring-[#8ab4f8]">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 text-[#9aa0a6] hover:text-white transition-colors shrink-0"
              aria-label="Add emoji"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send message"
              className="flex-1 bg-transparent text-white text-base sm:text-sm outline-none placeholder-[#9aa0a6]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-1.5 rounded-full bg-[#8ab4f8] text-[#202124] disabled:opacity-40 disabled:hover:bg-[#8ab4f8] hover:bg-[#aecbfa] transition-colors shrink-0"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
