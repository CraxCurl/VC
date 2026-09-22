'use client';

import { useEffect, useRef, useState } from 'react';
import { MicOff } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  userName: string;
  isSelf?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isSpeaking?: boolean;
  objectFit?: 'cover' | 'contain';
  className?: string;
}

export function VideoTile({
  stream,
  userName,
  isSelf = false,
  isAudioMuted = false,
  isVideoMuted = false,
  isSpeaking = false,
  objectFit = 'cover',
  className = '',
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasActiveVideoTrack, setHasActiveVideoTrack] = useState(false);

  // Monitor tracks and stream changes
  useEffect(() => {
    const video = videoRef.current;

    const checkVideoTrack = () => {
      if (!stream) {
        setHasActiveVideoTrack(false);
        return;
      }
      const videoTracks = stream.getVideoTracks();
      const hasEnabledTrack = videoTracks.some((t) => t.enabled && t.readyState === 'live');
      setHasActiveVideoTrack(hasEnabledTrack || videoTracks.length > 0);
    };

    checkVideoTrack();

    if (stream) {
      if (video && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch((err) => {
          console.log('Video autoplay deferred:', err?.message || err);
        });
      }

      stream.onaddtrack = checkVideoTrack;
      stream.onremovetrack = checkVideoTrack;
    } else if (video) {
      video.srcObject = null;
    }

    const interval = setInterval(checkVideoTrack, 1000);
    return () => {
      clearInterval(interval);
      if (stream) {
        stream.onaddtrack = null;
        stream.onremovetrack = null;
      }
    };
  }, [stream]);

  // Callback ref guarantees stream binding when DOM element renders
  const setVideoRef = (element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && stream) {
      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }
      element.play().catch(() => {});
    }
  };

  const showVideo = !isVideoMuted && Boolean(stream) && (hasActiveVideoTrack || Boolean(stream?.getVideoTracks()?.length));
  const initials = (userName || 'User').trim().charAt(0).toUpperCase() || 'U';

  return (
    <div
      className={`relative w-full h-full bg-[#1e1f20] rounded-2xl sm:rounded-3xl border transition-all duration-300 overflow-hidden flex items-center justify-center shadow-xl ${
        isSpeaking
          ? 'border-[#8ab4f8] ring-2 sm:ring-4 ring-[#8ab4f8]/50'
          : 'border-[#3c4043]/80 hover:border-[#5f6368]'
      } ${className}`}
    >
      {/* Video Element */}
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={isSelf} // Self is always muted to avoid acoustic feedback
        className={`w-full h-full ${
          objectFit === 'contain' ? 'object-contain' : 'object-cover'
        } ${isSelf ? '-scale-x-100' : ''} transition-opacity duration-300 ${
          showVideo ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        }`}
      />

      {/* Camera Off Avatar Placeholder */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1f20] p-4 text-center select-none animate-in fade-in duration-200 z-0">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#303134] to-[#3c4043] border border-[#5f6368] flex items-center justify-center text-2xl sm:text-4xl font-bold text-[#8ab4f8] shadow-lg">
            {initials}
          </div>
          <p className="text-xs sm:text-sm text-[#9aa0a6] mt-2 sm:mt-3 font-medium truncate max-w-[80%]">
            {userName} {isSelf && '(You)'}
          </p>
          <span className="text-[11px] text-[#5f6368] mt-0.5">Camera is off</span>
        </div>
      )}

      {/* Name and Mic Status Badge */}
      <div className="absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 z-20 bg-black/60 backdrop-blur-md px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium text-white flex items-center gap-1.5 sm:gap-2 max-w-[85%] border border-white/10 shadow-md">
        <span className="truncate">
          {userName} {isSelf && '(You)'}
        </span>
        {isAudioMuted ? (
          <div className="w-4 h-4 rounded-full bg-[#ea4335] flex items-center justify-center shrink-0">
            <MicOff className="w-2.5 h-2.5 text-white" />
          </div>
        ) : isSpeaking ? (
          <div className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 h-2 bg-[#81c995] animate-pulse rounded-full" />
            <span className="w-0.5 h-3 bg-[#81c995] animate-pulse delay-75 rounded-full" />
            <span className="w-0.5 h-1.5 bg-[#81c995] animate-pulse delay-150 rounded-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
