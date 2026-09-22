'use client';

import { useState, useRef, useEffect } from 'react';
import { QualityPreset, QUALITY_PRESETS } from '@/types/meeting';
import { createAudioLevelMonitor, generateRoomId } from '@/lib/webrtc-utils';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  Zap,
  ArrowRight,
  Sparkles,
  Shield,
  Copy,
  Check,
  Share2,
} from 'lucide-react';

interface LobbyProps {
  onJoinRoom: (config: {
    roomId: string;
    userName: string;
    qualityPreset: QualityPreset;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  }) => void;
  initialRoomId?: string;
  onOpenSettings: () => void;
  qualityPreset: QualityPreset;
  onQualityChange: (preset: QualityPreset) => void;
}

export function Lobby({
  onJoinRoom,
  initialRoomId = '',
  onOpenSettings,
  qualityPreset,
  onQualityChange,
}: LobbyProps) {
  const [userName, setUserName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState(initialRoomId);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize preview stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cleanupMonitor: (() => void) | null = null;

    async function initPreview() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
        setPreviewStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        cleanupMonitor = createAudioLevelMonitor(stream, (level) => {
          setAudioLevel(level);
        });
      } catch (err) {
        console.warn('Could not start preview stream:', err);
      }
    }

    initPreview();

    return () => {
      if (cleanupMonitor) cleanupMonitor();
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Sync mute toggles with preview stream
  const togglePreviewAudio = () => {
    if (previewStream) {
      const next = !isAudioMuted;
      previewStream.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      setIsAudioMuted(next);
    }
  };

  const togglePreviewVideo = () => {
    if (previewStream) {
      const next = !isVideoMuted;
      previewStream.getVideoTracks().forEach((t) => {
        t.enabled = !next;
      });
      setIsVideoMuted(next);
    }
  };

  const handleStartNewMeeting = () => {
    const newRoomId = generateRoomId();
    onJoinRoom({
      roomId: newRoomId,
      userName: userName.trim() || 'You',
      qualityPreset,
      isAudioMuted,
      isVideoMuted,
    });
  };

  const handleJoinExisting = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoomId = roomIdInput.trim().replace(/^.*\/room\//, '');
    if (!cleanRoomId) return;

    onJoinRoom({
      roomId: cleanRoomId,
      userName: userName.trim() || 'Friend',
      qualityPreset,
      isAudioMuted,
      isVideoMuted,
    });
  };

  return (
    <div className="min-h-screen bg-[#131314] text-white flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#282a2d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a73e8] to-[#8ab4f8] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white to-[#9aa0a6] bg-clip-text text-transparent">
              Meet Duo
            </span>
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[#303134] text-[#8ab4f8] border border-[#3c4043]">
              1-on-1 P2P
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Low Bandwidth quick toggle badge */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#202124] border border-[#3c4043] text-xs font-medium text-[#81c995] hover:bg-[#303134] transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-[#81c995]" />
            <span>{QUALITY_PRESETS[qualityPreset].label}</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-full bg-[#202124] border border-[#3c4043] text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-all"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col lg:flex-row items-center justify-center gap-10">
        {/* Left Side: Video Preview Card */}
        <div className="w-full lg:w-7/12 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-[#202124] rounded-3xl border border-[#3c4043] overflow-hidden shadow-2xl flex items-center justify-center group">
            {/* Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${
                isVideoMuted ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Camera Off Avatar Fallback */}
            {isVideoMuted && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                <div className="w-24 h-24 rounded-full bg-[#303134] border border-[#5f6368] flex items-center justify-center text-3xl font-bold text-[#8ab4f8]">
                  {userName.trim() ? userName.trim().charAt(0).toUpperCase() : 'U'}
                </div>
                <p className="text-sm text-[#9aa0a6] mt-3 font-medium">Camera is off</p>
              </div>
            )}

            {/* Audio Volume Bar (Visualizer) */}
            <div className="absolute bottom-5 left-5 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  isAudioMuted ? 'bg-[#ea4335]' : audioLevel > 15 ? 'bg-[#81c995]' : 'bg-[#9aa0a6]'
                }`}
              />
              <div className="w-16 h-1.5 bg-[#3c4043] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#81c995] transition-all duration-75"
                  style={{ width: `${isAudioMuted ? 0 : audioLevel}%` }}
                />
              </div>
            </div>

            {/* Preview Controls (Mic & Video toggles) */}
            <div className="absolute bottom-5 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePreviewAudio}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isAudioMuted
                    ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                    : 'bg-[#3c4043]/90 hover:bg-[#4f5357] text-white backdrop-blur-sm'
                }`}
                aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={togglePreviewVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isVideoMuted
                    ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                    : 'bg-[#3c4043]/90 hover:bg-[#4f5357] text-white backdrop-blur-sm'
                }`}
                aria-label={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Join & Lobby Options */}
        <div className="w-full lg:w-5/12 flex flex-col space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              Ready to connect?
            </h1>
            <p className="text-sm text-[#9aa0a6]">
              Private, zero-latency 1-on-1 video calling. Direct peer-to-peer connection for minimal data usage.
            </p>
          </div>

          {/* User Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-[#202124] border border-[#3c4043] rounded-2xl px-4 py-3 text-white placeholder-[#5f6368] outline-none focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] transition-all"
            />
          </div>

          {/* Action 1: Create New Room */}
          {!initialRoomId ? (
            <div className="space-y-3 pt-2">
              <button
                onClick={handleStartNewMeeting}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start instant 1-on-1 call</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#3c4043]" />
                <span className="flex-shrink mx-4 text-xs text-[#5f6368] font-medium uppercase">
                  or join friend's code
                </span>
                <div className="flex-grow border-t border-[#3c4043]" />
              </div>

              {/* Join Existing Input */}
              <form onSubmit={handleJoinExisting} className="flex gap-2">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  placeholder="Enter room code (e.g. abc-defg-hij)"
                  className="flex-1 bg-[#202124] border border-[#3c4043] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#5f6368] outline-none focus:border-[#8ab4f8] transition-all"
                />
                <button
                  type="submit"
                  disabled={!roomIdInput.trim()}
                  className="px-5 py-3 rounded-2xl bg-[#303134] hover:bg-[#3c4043] disabled:opacity-40 text-white font-medium text-sm flex items-center gap-1.5 transition-all"
                >
                  <span>Join</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            /* Joining Invited Room */
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-2xl bg-[#202124] border border-[#3c4043]">
                <div className="text-xs text-[#9aa0a6]">Joining room:</div>
                <div className="font-mono text-base text-[#8ab4f8] font-bold mt-0.5">
                  {initialRoomId}
                </div>
              </div>

              <button
                onClick={handleJoinExisting}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01]"
              >
                <span>Join Call Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Privacy & Low Data badge */}
          <div className="pt-2 flex items-center justify-between text-xs text-[#9aa0a6] px-1">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#81c995]" />
              <span>Direct P2P Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#fbbc04]" />
              <span>Low-Data Optimized</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#5f6368] border-t border-[#282a2d]">
        Meet Duo &bull; Designed for you &amp; your friend &bull; Vercel Serverless Ready
      </footer>
    </div>
  );
}
