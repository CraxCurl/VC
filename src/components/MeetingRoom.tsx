'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QualityPreset, QUALITY_PRESETS } from '@/types/meeting';
import { VideoTile } from '@/components/VideoTile';
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
  Users,
  Sparkles,
  LayoutGrid,
  SquareDashedBottomCode,
  ShieldCheck,
  AlertCircle,
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
  const [supportsScreenShare, setSupportsScreenShare] = useState(true);

  // Initialize WebRTC
  const {
    localStream,
    remoteStream,
    peerId,
    remotePeerState,
    isConnected,
    isConnecting,
    connectionError,
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

  // Detect screen share support (unavailable on most mobile browsers)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getDisplayMedia) {
      setSupportsScreenShare(false);
    }
  }, []);

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

  const handleToggleDataSaver = () => {
    const nextPreset: QualityPreset = qualityPreset === 'eco' ? 'balanced' : 'eco';
    changeQualityPreset(nextPreset);
  };

  const isRemoteSpeaking = remotePeerState?.isSpeaking ?? false;
  const isRemoteVideoOff = remotePeerState?.isVideoMuted || !remoteStream;
  const isRemoteAudioOff = remotePeerState?.isAudioMuted ?? false;

  return (
    <div className="relative h-[100dvh] w-screen bg-[#131314] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Floating Reactions Overlay */}
      <ReactionOverlay ref={reactionOverlayRef} />

      {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-2.5 sm:p-4 pointer-events-none gap-2">
        {/* Room Info / Time Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl flex items-center gap-2 sm:gap-3 shadow-lg max-w-[200px] sm:max-w-none">
            <span className="hidden sm:inline text-xs sm:text-sm font-semibold text-white tracking-wide">{currentTime}</span>
            <div className="hidden sm:block w-[1px] h-3.5 bg-[#3c4043]" />
            <span className="text-[11px] sm:text-xs font-mono text-[#8ab4f8] truncate">{roomId}</span>
            <button
              onClick={handleCopyInvite}
              className="p-1 rounded-md text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors shrink-0"
              title="Copy invite link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#81c995]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {copiedLink && (
            <div className="hidden md:block bg-[#81c995]/20 border border-[#81c995] text-[#81c995] text-xs px-3 py-1.5 rounded-xl font-medium animate-in fade-in slide-in-from-top-1">
              Invite link copied!
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {/* Layout Mode switcher (when connected) */}
          {isConnected && (
            <button
              onClick={() => setLayoutMode((prev) => (prev === 'split' ? 'pip' : 'split'))}
              className="p-1.5 sm:p-2 rounded-xl bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
              title={layoutMode === 'split' ? 'Switch to Picture-in-Picture' : 'Switch to Grid View'}
            >
              {layoutMode === 'split' ? (
                <SquareDashedBottomCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          )}

          {/* Quick Data Saver Status Pill */}
          <button
            onClick={handleToggleDataSaver}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-medium border backdrop-blur-md transition-all ${
              qualityPreset === 'eco'
                ? 'bg-[#81c995]/20 text-[#81c995] border-[#81c995]/40 hover:bg-[#81c995]/30'
                : 'bg-[#202124]/90 text-[#9aa0a6] border-[#3c4043] hover:text-white'
            }`}
            title="Click to toggle Data Saver"
          >
            <Zap className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${qualityPreset === 'eco' ? 'fill-[#81c995]' : ''}`} />
            <span className="hidden xs:inline">{qualityPreset === 'eco' ? 'Eco Data' : 'HD'}</span>
          </button>

          {/* Participant count */}
          <div className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[11px] sm:text-xs font-medium text-[#e8eaed]">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8ab4f8]" />
            <span>{isConnected ? '2' : '1'}/2</span>
          </div>
        </div>
      </header>

      {/* Main Video Viewport */}
      <main className="flex-1 w-full h-full p-2.5 sm:p-4 pt-14 sm:pt-16 pb-20 sm:pb-24 flex items-center justify-center relative overflow-hidden">
        {/* Error notification banner if any */}
        {connectionError && (
          <div className="absolute top-16 z-20 mx-4 px-4 py-2 bg-[#ea4335]/90 border border-red-400 text-white text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-xl animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{connectionError}</span>
          </div>
        )}

        {/* State A: Waiting for friend to join */}
        {!isConnected ? (
          <div className="w-full h-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-3 sm:gap-6 overflow-y-auto max-h-full py-1">
            {/* Self preview tile */}
            <div className="w-full lg:w-3/5 h-[42vh] lg:h-[55vh] max-h-[480px]">
              <VideoTile
                stream={localStream}
                userName={userName}
                isSelf={true}
                isAudioMuted={isAudioMuted}
                isVideoMuted={isVideoMuted}
                isSpeaking={isLocalSpeaking}
                className="w-full h-full"
              />
            </div>

            {/* Waiting Card & Share Link */}
            <div className="w-full lg:w-2/5 bg-[#202124] border border-[#3c4043] rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#8ab4f8]/10 border border-[#8ab4f8]/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#8ab4f8]" />
                </div>
                <h3 className="text-base sm:text-xl font-semibold text-white">Waiting for your friend...</h3>
                <p className="text-xs text-[#9aa0a6] leading-relaxed">
                  Share this room link or code. The moment she connects, your 2-way call begins instantly.
                </p>
              </div>

              {/* Room Link Box */}
              <div className="p-3 bg-[#1a1a1c] border border-[#3c4043] rounded-2xl space-y-1">
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider">
                  Invite Link
                </span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-xs text-[#8ab4f8] truncate select-all">
                    {typeof window !== 'undefined' ? `${window.location.host}/?room=${roomId}` : roomId}
                  </span>
                  <button
                    onClick={handleCopyInvite}
                    className="px-3 py-1.5 bg-[#8ab4f8] text-[#202124] rounded-xl text-xs font-semibold hover:bg-[#aecbfa] transition-colors flex items-center gap-1 shrink-0 active:scale-95"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-[#81c995]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>P2P Direct &bull; Zero Server Video Storing</span>
              </div>
            </div>
          </div>
        ) : (
          /* State B: Connected 1-on-1 Call */
          <div className="w-full h-full max-w-7xl relative flex items-center justify-center">
            {layoutMode === 'split' ? (
              /* Side-by-Side (Desktop) / Vertical Split (Mobile/Tablet) */
              <div className="w-full h-full flex flex-col sm:grid sm:grid-cols-2 gap-2.5 sm:gap-4 max-h-full">
                {/* Remote Participant Video Tile */}
                <div className="flex-1 sm:flex-none sm:h-full min-h-0">
                  <VideoTile
                    stream={remoteStream}
                    userName={remotePeerState?.name || 'Friend'}
                    isSelf={false}
                    isAudioMuted={isRemoteAudioOff}
                    isVideoMuted={isRemoteVideoOff}
                    isSpeaking={isRemoteSpeaking}
                    className="w-full h-full"
                  />
                </div>

                {/* Local Participant Video Tile */}
                <div className="flex-1 sm:flex-none sm:h-full min-h-0">
                  <VideoTile
                    stream={localStream}
                    userName={userName}
                    isSelf={true}
                    isAudioMuted={isAudioMuted}
                    isVideoMuted={isVideoMuted}
                    isSpeaking={isLocalSpeaking}
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              /* Picture-in-Picture Mode */
              <div className="w-full h-full relative">
                {/* Main Remote Feed */}
                <VideoTile
                  stream={remoteStream}
                  userName={remotePeerState?.name || 'Friend'}
                  isSelf={false}
                  isAudioMuted={isRemoteAudioOff}
                  isVideoMuted={isRemoteVideoOff}
                  isSpeaking={isRemoteSpeaking}
                  objectFit="contain"
                  className="w-full h-full"
                />

                {/* Floating Self Feed (PiP) */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-28 sm:w-56 md:w-64 aspect-video z-20 shadow-2xl transition-all">
                  <VideoTile
                    stream={localStream}
                    userName={userName}
                    isSelf={true}
                    isAudioMuted={isAudioMuted}
                    isVideoMuted={isVideoMuted}
                    isSpeaking={isLocalSpeaking}
                    className="w-full h-full border-2 border-[#8ab4f8]/80 ring-2 ring-black/40"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom Control Bar */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 p-2 sm:p-4 flex items-center justify-between pointer-events-none">
        {/* Left: Desktop Room Info */}
        <div className="hidden lg:flex items-center gap-2 pointer-events-auto">
          <span className="text-xs text-[#9aa0a6] font-mono bg-[#202124]/80 px-3 py-1.5 rounded-xl border border-[#3c4043]">
            {roomId}
          </span>
        </div>

        {/* Center: Main Floating Controls */}
        <div className="mx-auto flex items-center gap-1.5 sm:gap-2.5 bg-[#202124]/95 backdrop-blur-xl border border-[#3c4043] px-3 py-2 sm:px-5 sm:py-2.5 rounded-full shadow-2xl pointer-events-auto">
          {/* Microphone */}
          <button
            onClick={toggleAudio}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
              isAudioMuted
                ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                : 'bg-[#3c4043] text-white hover:bg-[#4f5357]'
            }`}
            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
              isVideoMuted
                ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                : 'bg-[#3c4043] text-white hover:bg-[#4f5357]'
            }`}
            title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
            aria-label={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoMuted ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Screen Share (Only when supported by browser) */}
          {supportsScreenShare && (
            <button
              onClick={toggleScreenShare}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
                isScreenSharing
                  ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                  : 'bg-[#3c4043] text-white hover:bg-[#4f5357]'
              }`}
              title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
              aria-label={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
            >
              <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Quick Data Saver toggle */}
          <button
            onClick={handleToggleDataSaver}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
              qualityPreset === 'eco'
                ? 'bg-[#81c995] text-[#202124] hover:bg-[#a8dab5]'
                : 'bg-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#4f5357]'
            }`}
            title={`Data Saver Mode: ${qualityPreset === 'eco' ? 'ON (Eco 360p)' : 'OFF'}`}
            aria-label="Toggle Data Saver"
          >
            <Zap className={`w-4 h-4 sm:w-5 sm:h-5 ${qualityPreset === 'eco' ? 'fill-[#202124]' : ''}`} />
          </button>

          {/* Reactions Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#3c4043] text-white hover:bg-[#4f5357] flex items-center justify-center transition-all text-base sm:text-lg"
              title="Send reaction"
              aria-label="Send reaction"
            >
              ❤️
            </button>

            {/* Reactions Popover */}
            {showReactionsMenu && (
              <div className="absolute bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 bg-[#282a2d] border border-[#3c4043] rounded-full p-1 sm:p-1.5 flex items-center gap-1 shadow-2xl animate-in zoom-in-90 duration-150 z-50">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="p-1.5 sm:p-2 hover:bg-[#3c4043] rounded-full text-lg sm:text-xl transition-transform hover:scale-125 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="px-3.5 sm:px-5 h-10 sm:h-11 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white flex items-center justify-center gap-1.5 font-medium transition-all shadow-lg shadow-red-500/20 active:scale-95"
            title="Leave call"
            aria-label="Leave call"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden md:inline text-xs sm:text-sm font-semibold">Leave</span>
          </button>
        </div>

        {/* Right: Chat & Settings Triggers */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Chat Drawer */}
          <button
            onClick={handleOpenChat}
            className="relative p-2.5 sm:p-3 rounded-full bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
            title="Open Chat"
            aria-label="Open Chat"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#8ab4f8] text-[#202124] text-[10px] sm:text-xs font-bold flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 sm:p-3 rounded-full bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
            title="Call settings"
            aria-label="Call settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
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

      {/* In-Call Settings Modal */}
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
