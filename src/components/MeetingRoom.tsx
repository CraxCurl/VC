'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QualityPreset, QUALITY_PRESETS } from '@/types/meeting';
import { ChatDrawer } from '@/components/ChatDrawer';
import { SettingsModal } from '@/components/SettingsModal';
import { ReactionOverlay, ReactionOverlayRef } from '@/components/ReactionOverlay';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  MessageSquare,
  Settings,
  Zap,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Users,
  Sparkles,
  LayoutGrid,
  SquareDashedBottomCode,
  ShieldCheck,
} from 'lucide-react';

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  initialPreset: QualityPreset;
  initialAudioMuted: boolean;
  initialVideoMuted: boolean;
  onLeave: () => void;
}

const REACTIONS = ['❤️', '👍', '😂', '🎉', '🔥', '👏'];

export function MeetingRoom({
  roomId,
  userName,
  initialPreset,
  initialAudioMuted,
  initialVideoMuted,
  onLeave,
}: MeetingRoomProps) {
  const reactionOverlayRef = useRef<ReactionOverlayRef>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'pip' | 'split'>('split');
  const [currentTime, setCurrentTime] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize WebRTC
  const {
    localStream,
    remoteStream,
    peerId,
    remotePeerState,
    isConnected,
    isConnecting,
    connectionError,
    connectToPeer,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    qualityPreset,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    changeQualityPreset,
    leaveCall,
    isLocalSpeaking,
    chatMessages,
    sendChatMessage,
    sendReaction,
    networkStats,
    selectedAudioDevice,
    selectedVideoDevice,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
  } = useWebRTC({
    roomId,
    userName,
    initialPreset,
    initialAudioMuted,
    initialVideoMuted,
    onReactionReceived: (emoji) => {
      reactionOverlayRef.current?.addReaction(emoji);
    },
  });

  // Track time
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Unread chat badge
  useEffect(() => {
    if (!isChatOpen && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (!lastMsg.isSelf) {
        setUnreadCount((prev) => prev + 1);
      }
    }
  }, [chatMessages, isChatOpen]);

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setUnreadCount(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'd' || e.key === 'D' || (e.ctrlKey && e.key === 'd')) {
        e.preventDefault();
        toggleAudio();
      } else if (e.key === 'e' || e.key === 'E' || (e.ctrlKey && e.key === 'e')) {
        e.preventDefault();
        toggleVideo();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
        if (!isChatOpen) setUnreadCount(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAudio, toggleVideo, isChatOpen]);

  const handleCopyInvite = () => {
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomId}` : roomId;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendReaction = (emoji: string) => {
    reactionOverlayRef.current?.addReaction(emoji);
    sendReaction(emoji);
    setShowReactionsMenu(false);
  };

  const handleEndCall = () => {
    leaveCall();
    onLeave();
  };

  // Toggle quick data saver mode
  const handleToggleDataSaver = () => {
    const nextPreset: QualityPreset = qualityPreset === 'eco' ? 'balanced' : 'eco';
    changeQualityPreset(nextPreset);
  };

  const isRemoteSpeaking = remotePeerState?.isSpeaking ?? false;
  const isRemoteVideoOff = remotePeerState?.isVideoMuted || !remoteStream;
  const isRemoteAudioOff = remotePeerState?.isAudioMuted ?? false;

  return (
    <div className="relative h-screen w-screen bg-[#131314] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Floating Reactions Overlay */}
      <ReactionOverlay ref={reactionOverlayRef} />

      {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] px-4 py-2 rounded-2xl flex items-center gap-3 shadow-lg">
            <span className="text-sm font-semibold text-white tracking-wide">{currentTime}</span>
            <div className="w-[1px] h-4 bg-[#3c4043]" />
            <span className="text-xs font-mono text-[#8ab4f8]">{roomId}</span>
            <button
              onClick={handleCopyInvite}
              className="p-1 rounded-md text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors"
              title="Copy invite link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#81c995]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {copiedLink && (
            <div className="bg-[#81c995]/20 border border-[#81c995] text-[#81c995] text-xs px-3 py-1.5 rounded-xl font-medium animate-in fade-in slide-in-from-top-1">
              Invite link copied to clipboard!
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Layout Mode switcher (if 2 participants) */}
          {isConnected && (
            <button
              onClick={() => setLayoutMode((prev) => (prev === 'split' ? 'pip' : 'split'))}
              className="p-2 rounded-xl bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
              title={layoutMode === 'split' ? 'Switch to Floating Picture-in-Picture' : 'Switch to Side-by-Side Grid'}
            >
              {layoutMode === 'split' ? <SquareDashedBottomCode className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>
          )}

          {/* Quick Data Saver status chip */}
          <button
            onClick={handleToggleDataSaver}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md transition-all ${
              qualityPreset === 'eco'
                ? 'bg-[#81c995]/20 text-[#81c995] border-[#81c995]/40 hover:bg-[#81c995]/30'
                : 'bg-[#202124]/90 text-[#9aa0a6] border-[#3c4043] hover:text-white'
            }`}
            title="Click to toggle Data Saver (Low Bandwidth Mode)"
          >
            <Zap className={`w-3.5 h-3.5 ${qualityPreset === 'eco' ? 'fill-[#81c995]' : ''}`} />
            <span>{QUALITY_PRESETS[qualityPreset].label}</span>
          </button>

          {/* Participant count */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-xs font-medium text-[#e8eaed]">
            <Users className="w-3.5 h-3.5 text-[#8ab4f8]" />
            <span>{isConnected ? '2 / 2' : '1 / 2'}</span>
          </div>
        </div>
      </header>

      {/* Main Video Viewport */}
      <main className="flex-1 w-full h-full p-4 pt-18 pb-24 flex items-center justify-center relative">
        {/* State A: Waiting for remote peer to connect */}
        {!isConnected ? (
          <div className="w-full h-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-6">
            {/* Self preview tile */}
            <div
              className={`relative w-full lg:w-3/5 aspect-video bg-[#202124] rounded-3xl border ${
                isLocalSpeaking ? 'border-[#8ab4f8] ring-4 ring-[#8ab4f8]/30' : 'border-[#3c4043]'
              } overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-200`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
              />

              {isVideoMuted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                  <div className="w-20 h-20 rounded-full bg-[#303134] flex items-center justify-center text-3xl font-bold text-[#8ab4f8]">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs text-[#9aa0a6] mt-2">Camera is off</p>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                <span>{userName} (You)</span>
                {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-[#ea4335]" />}
              </div>
            </div>

            {/* Waiting Card / Invite Info */}
            <div className="w-full lg:w-2/5 bg-[#202124] border border-[#3c4043] rounded-3xl p-6 flex flex-col justify-between shadow-2xl space-y-4">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#8ab4f8]/10 border border-[#8ab4f8]/30 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#8ab4f8]" />
                </div>
                <h3 className="text-xl font-semibold text-white">Waiting for your friend...</h3>
                <p className="text-xs text-[#9aa0a6] leading-relaxed">
                  Share this room code or link. As soon as she opens it, you will connect instantly.
                </p>
              </div>

              {/* Peer ID connect manual helper if needed */}
              <div className="p-3 bg-[#1a1a1c] border border-[#3c4043] rounded-2xl space-y-1">
                <span className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider">
                  Direct Room Link
                </span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-xs text-[#8ab4f8] truncate">
                    {typeof window !== 'undefined' ? `${window.location.host}/?room=${roomId}` : roomId}
                  </span>
                  <button
                    onClick={handleCopyInvite}
                    className="px-3 py-1.5 bg-[#8ab4f8] text-[#202124] rounded-xl text-xs font-semibold hover:bg-[#aecbfa] transition-colors flex items-center gap-1 shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#81c995]">
                <ShieldCheck className="w-4 h-4" />
                <span>Ready for private 1-on-1 call</span>
              </div>
            </div>
          </div>
        ) : (
          /* State B: Connected 1-on-1 Call */
          <div className="w-full h-full max-w-7xl relative flex items-center justify-center">
            {layoutMode === 'split' ? (
              /* Side-by-Side Grid Mode */
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Remote Participant Video Tile */}
                <div
                  className={`relative w-full h-full min-h-[300px] bg-[#202124] rounded-3xl border ${
                    isRemoteSpeaking ? 'border-[#8ab4f8] ring-4 ring-[#8ab4f8]/40' : 'border-[#3c4043]'
                  } overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-200`}
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${isRemoteVideoOff ? 'opacity-0' : 'opacity-100'}`}
                  />

                  {isRemoteVideoOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                      <div className="w-24 h-24 rounded-full bg-[#303134] border border-[#5f6368] flex items-center justify-center text-4xl font-bold text-[#8ab4f8]">
                        {(remotePeerState?.name || 'Friend').charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm text-[#9aa0a6] mt-3 font-medium">
                        {remotePeerState?.name || 'Friend'} (Camera Off)
                      </p>
                    </div>
                  )}

                  {/* Tile badge */}
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                    <span>{remotePeerState?.name || 'Friend'}</span>
                    {isRemoteAudioOff && <MicOff className="w-3.5 h-3.5 text-[#ea4335]" />}
                  </div>
                </div>

                {/* Local Participant Video Tile */}
                <div
                  className={`relative w-full h-full min-h-[300px] bg-[#202124] rounded-3xl border ${
                    isLocalSpeaking ? 'border-[#8ab4f8] ring-4 ring-[#8ab4f8]/40' : 'border-[#3c4043]'
                  } overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-200`}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
                  />

                  {isVideoMuted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                      <div className="w-24 h-24 rounded-full bg-[#303134] border border-[#5f6368] flex items-center justify-center text-4xl font-bold text-[#8ab4f8]">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm text-[#9aa0a6] mt-3 font-medium">You (Camera Off)</p>
                    </div>
                  )}

                  {/* Tile badge */}
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                    <span>{userName} (You)</span>
                    {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-[#ea4335]" />}
                  </div>
                </div>
              </div>
            ) : (
              /* Picture-in-Picture Floating Mode */
              <div className="w-full h-full relative">
                {/* Main Remote Screen */}
                <div
                  className={`w-full h-full bg-[#202124] rounded-3xl border ${
                    isRemoteSpeaking ? 'border-[#8ab4f8] ring-4 ring-[#8ab4f8]/40' : 'border-[#3c4043]'
                  } overflow-hidden shadow-2xl flex items-center justify-center`}
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-contain ${isRemoteVideoOff ? 'opacity-0' : 'opacity-100'}`}
                  />

                  {isRemoteVideoOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                      <div className="w-28 h-28 rounded-full bg-[#303134] border border-[#5f6368] flex items-center justify-center text-4xl font-bold text-[#8ab4f8]">
                        {(remotePeerState?.name || 'Friend').charAt(0).toUpperCase()}
                      </div>
                      <p className="text-base text-[#9aa0a6] mt-3 font-medium">
                        {remotePeerState?.name || 'Friend'}
                      </p>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2">
                    <span>{remotePeerState?.name || 'Friend'}</span>
                    {isRemoteAudioOff && <MicOff className="w-3.5 h-3.5 text-[#ea4335]" />}
                  </div>
                </div>

                {/* Floating Self View (Picture-in-Picture) */}
                <div
                  className={`absolute top-4 right-4 w-48 sm:w-64 aspect-video bg-[#202124] rounded-2xl border ${
                    isLocalSpeaking ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8]' : 'border-[#3c4043]'
                  } overflow-hidden shadow-2xl z-20 transition-all`}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
                  />
                  {isVideoMuted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#202124] text-sm font-semibold text-[#8ab4f8]">
                      {userName}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px]">
                    You {isAudioMuted && '(Muted)'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom Control Bar */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 p-4 flex items-center justify-between pointer-events-none">
        {/* Left Side: Room Info */}
        <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
          <span className="text-xs text-[#9aa0a6] font-mono">{roomId}</span>
        </div>

        {/* Center: Main Floating Toolbar */}
        <div className="mx-auto flex items-center gap-2.5 bg-[#202124]/95 backdrop-blur-xl border border-[#3c4043] px-5 py-2.5 rounded-full shadow-2xl pointer-events-auto">
          {/* Microphone Toggle */}
          <button
            onClick={toggleAudio}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isAudioMuted
                ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                : 'bg-[#3c4043] text-white hover:bg-[#4f5357]'
            }`}
            title={isAudioMuted ? 'Unmute microphone (M)' : 'Mute microphone (M)'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleVideo}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isVideoMuted
                ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                : 'bg-[#3c4043] text-white hover:bg-[#4f5357]'
            }`}
            title={isVideoMuted ? 'Turn on camera (V)' : 'Turn off camera (V)'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                : 'bg-[#3c4043] text-white hover:bg-[#4f5357]'
            }`}
            title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* Low Bandwidth / Data Saver Toggle */}
          <button
            onClick={handleToggleDataSaver}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              qualityPreset === 'eco'
                ? 'bg-[#81c995] text-[#202124] hover:bg-[#a8dab5]'
                : 'bg-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#4f5357]'
            }`}
            title={`Data Saver Mode: ${qualityPreset === 'eco' ? 'ON (Eco 360p)' : 'OFF'}`}
          >
            <Zap className={`w-5 h-5 ${qualityPreset === 'eco' ? 'fill-[#202124]' : ''}`} />
          </button>

          {/* Reactions Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className="w-11 h-11 rounded-full bg-[#3c4043] text-white hover:bg-[#4f5357] flex items-center justify-center transition-all text-lg"
              title="Send reaction"
            >
              ❤️
            </button>

            {/* Reactions Picker Popover */}
            {showReactionsMenu && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#282a2d] border border-[#3c4043] rounded-full p-1.5 flex items-center gap-1 shadow-2xl animate-in zoom-in-90 duration-150">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="p-2 hover:bg-[#3c4043] rounded-full text-xl transition-transform hover:scale-130"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="px-5 h-11 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white flex items-center justify-center gap-2 font-medium transition-all shadow-lg shadow-red-500/20"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-semibold">Leave</span>
          </button>
        </div>

        {/* Right Side: Chat & Settings Triggers */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Chat Drawer Button */}
          <button
            onClick={handleOpenChat}
            className="relative p-3 rounded-full bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
            title="Open Chat (C)"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#8ab4f8] text-[#202124] text-xs font-bold flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 rounded-full bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
            title="Meeting settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* In-Call Live Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
        currentUserId={peerId}
      />

      {/* In-Call Settings & Diagnostics Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        qualityPreset={qualityPreset}
        onQualityChange={changeQualityPreset}
        selectedAudioDevice={selectedAudioDevice}
        selectedVideoDevice={selectedVideoDevice}
        onAudioDeviceChange={setSelectedAudioDevice}
        onVideoDeviceChange={setSelectedVideoDevice}
        networkStats={networkStats}
      />
    </div>
  );
}
