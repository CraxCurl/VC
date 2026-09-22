'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type Peer from 'peerjs';
import type { MediaConnection, DataConnection } from 'peerjs';
import {
  ChatMessage,
  NetworkStats,
  PeerDataPayload,
  PeerState,
  QualityPreset,
} from '@/types/meeting';
import {
  applyBandwidthConstraints,
  createAudioLevelMonitor,
  getMediaConstraints,
  ICE_SERVERS,
} from '@/lib/webrtc-utils';
import {
  playJoinSound,
  playLeaveSound,
  playMessageSound,
  playToggleSound,
} from '@/lib/audio-effects';

interface UseWebRTCOptions {
  roomId: string;
  userName: string;
  initialPreset?: QualityPreset;
  initialAudioMuted?: boolean;
  initialVideoMuted?: boolean;
  onRemoteJoined?: () => void;
  onRemoteLeft?: () => void;
  onReactionReceived?: (emoji: string) => void;
}

export function useWebRTC({
  roomId,
  userName,
  initialPreset = 'eco',
  initialAudioMuted = false,
  initialVideoMuted = false,
  onRemoteJoined,
  onRemoteLeft,
  onReactionReceived,
}: UseWebRTCOptions) {
  // Local Media & State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(initialAudioMuted);
  const [isVideoMuted, setIsVideoMuted] = useState(initialVideoMuted);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>(initialPreset);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // Peer & Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [remotePeerState, setRemotePeerState] = useState<PeerState | null>(null);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);

  // In-Call Chat & Diagnostics
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Device IDs
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIncomingCallRef = useRef<MediaConnection | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const prevBytesRef = useRef<{ bytes: number; timestamp: number }>({
    bytes: 0,
    timestamp: Date.now(),
  });

  // Dedicated Audio Element Ref for background remote audio
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize hidden background audio element on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.autoplay = true;
      (audio as any).playsInline = true;
      remoteAudioRef.current = audio;

      return () => {
        audio.srcObject = null;
        audio.pause();
      };
    }
  }, []);

  // Synchronize remote audio playback whenever remoteStream changes
  useEffect(() => {
    if (remoteAudioRef.current) {
      if (remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((err) => {
          console.log('Remote audio playback deferred:', err);
        });
      } else {
        remoteAudioRef.current.srcObject = null;
      }
    }
  }, [remoteStream]);

  // Keep local stream ref synchronized
  useEffect(() => {
    localStreamRef.current = localStream;
    // If an incoming call arrived before stream was ready, answer it now
    if (localStream && pendingIncomingCallRef.current) {
      const call = pendingIncomingCallRef.current;
      pendingIncomingCallRef.current = null;
      try {
        call.answer(localStream);
        setupMediaCall(call);
      } catch (e) {
        console.warn('Error answering pending call:', e);
      }
    }
  }, [localStream]);

  // Audio level monitors
  useEffect(() => {
    if (!localStream) return;
    const cleanup = createAudioLevelMonitor(localStream, (level, speaking) => {
      setLocalAudioLevel(level);
      setIsLocalSpeaking(speaking);
    });
    return cleanup;
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    const cleanup = createAudioLevelMonitor(remoteStream, (level, speaking) => {
      setRemoteAudioLevel(level);
      setRemotePeerState((prev) => (prev ? { ...prev, isSpeaking: speaking } : null));
    });
    return cleanup;
  }, [remoteStream]);

  // Broadcast state to remote peer
  const sendData = useCallback((payload: PeerDataPayload) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send(payload);
      } catch (e) {
        console.warn('Failed to send data payload:', e);
      }
    }
  }, []);

  const broadcastLocalState = useCallback(
    (overrides?: Partial<PeerState>) => {
      const state: PeerState = {
        name: userName,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        qualityPreset,
        isSpeaking: isLocalSpeaking,
        ...overrides,
      };
      sendData({ type: 'state-sync', payload: state });
    },
    [userName, isAudioMuted, isVideoMuted, isScreenSharing, qualityPreset, isLocalSpeaking, sendData]
  );

  // Initialize Local Media Stream
  const initLocalStream = useCallback(
    async (preset: QualityPreset = initialPreset, aDevId?: string, vDevId?: string) => {
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        let stream: MediaStream | null = null;
        try {
          const constraints = getMediaConstraints(
            preset,
            aDevId || selectedAudioDevice,
            vDevId || selectedVideoDevice
          );
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn('First-choice getUserMedia failed, attempting standard constraints:', e);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
          } catch (videoErr) {
            console.warn('Video acquisition failed, falling back to voice only:', videoErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsVideoMuted(true);
          }
        }

        if (!stream) {
          setConnectionError('Could not access camera or microphone. Please check browser permissions.');
          return null;
        }

        // Apply initial mute states
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !initialAudioMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !initialVideoMuted;
        });

        setLocalStream(stream);
        localStreamRef.current = stream;
        return stream;
      } catch (err: any) {
        console.error('Fatal media error:', err);
        setConnectionError('Could not access media devices. Please grant camera and microphone permissions.');
        return null;
      }
    },
    [initialAudioMuted, initialVideoMuted, selectedAudioDevice, selectedVideoDevice, initialPreset]
  );

  // Setup Media Call Listeners
  const setupMediaCall = useCallback(
    (call: MediaConnection) => {
      callRef.current = call;

      const handleStream = (rStream: MediaStream) => {
        setRemoteStream(rStream);
        setIsConnected(true);
        setRemotePeerId(call.peer);
        playJoinSound();
        if (onRemoteJoined) onRemoteJoined();

        if (call.peerConnection) {
          applyBandwidthConstraints(call.peerConnection, qualityPreset);
        }
      };

      call.on('stream', (rStream) => {
        handleStream(rStream);
      });

      if (call.peerConnection) {
        call.peerConnection.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            handleStream(event.streams[0]);
          }
        };
      }

      call.on('close', () => {
        setRemoteStream(null);
        setRemotePeerId(null);
        setRemotePeerState(null);
        setIsConnected(false);
        playLeaveSound();
        if (onRemoteLeft) onRemoteLeft();
      });

      call.on('error', (err) => {
        console.error('Media Call error:', err);
      });
    },
    [qualityPreset, onRemoteJoined, onRemoteLeft]
  );

  // Setup Data Connection Listeners
  const setupDataConnection = useCallback(
    (conn: DataConnection) => {
      dataConnRef.current = conn;

      conn.on('open', () => {
        setIsConnected(true);
        setRemotePeerId(conn.peer);
        broadcastLocalState();

        // Send greeting
        conn.send({
          type: 'chat',
          payload: {
            id: `sys-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            text: `${userName} connected.`,
            timestamp: Date.now(),
            isSelf: false,
          },
        });
      });

      conn.on('data', (data: any) => {
        const msg = data as PeerDataPayload;
        if (!msg || !msg.type) return;

        if (msg.type === 'chat') {
          const chatMsg: ChatMessage = {
            ...msg.payload,
            isSelf: false,
          };
          setChatMessages((prev) => [...prev, chatMsg]);
          playMessageSound();
        } else if (msg.type === 'reaction') {
          if (onReactionReceived && msg.payload?.emoji) {
            onReactionReceived(msg.payload.emoji);
          }
        } else if (msg.type === 'state-sync') {
          setRemotePeerState(msg.payload);
        } else if (msg.type === 'leave') {
          setRemoteStream(null);
          setRemotePeerId(null);
          setRemotePeerState(null);
          setIsConnected(false);
          playLeaveSound();
          if (onRemoteLeft) onRemoteLeft();
        }
      });

      conn.on('close', () => {
        setRemoteStream(null);
        setRemotePeerId(null);
        setRemotePeerState(null);
        setIsConnected(false);
        playLeaveSound();
        if (onRemoteLeft) onRemoteLeft();
      });

      conn.on('error', (err) => {
        console.warn('Data connection error:', err);
      });
    },
    [userName, broadcastLocalState, onReactionReceived, onRemoteLeft]
  );

  // Initialize WebRTC & Deterministic 1-on-1 Room Peer Matching
  useEffect(() => {
    let peerInstance: Peer | null = null;
    let isSubscribed = true;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const cleanRoomCode = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const slotA = `meet-${cleanRoomCode}-a`;
    const slotB = `meet-${cleanRoomCode}-b`;

    async function initPeerSession() {
      setIsConnecting(true);
      const stream = await initLocalStream(qualityPreset);

      if (!isSubscribed) return;

      const { default: Peer } = await import('peerjs');

      const peerConfig = {
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
        },
      };

      const startPeerInSlot = (mySlot: string, targetSlot: string, isInitiator: boolean) => {
        if (!isSubscribed) return;

        const peer = new Peer(mySlot, peerConfig);
        peerInstance = peer;
        peerRef.current = peer;

        peer.on('open', (id) => {
          if (!isSubscribed) return;
          setPeerId(id);
          setIsConnecting(false);

          const tryConnectTarget = () => {
            if (!isSubscribed || !peerRef.current || peerRef.current.destroyed) return;
            const currentStream = localStreamRef.current || stream;

            // Connect Data Channel
            if (!dataConnRef.current || !dataConnRef.current.open) {
              try {
                const dataConn = peer.connect(targetSlot, { reliable: true });
                setupDataConnection(dataConn);
              } catch (e) {}
            }

            // Only initiator (Guest/Slot B) initiates media call to avoid dual-call glare
            if (isInitiator && currentStream && (!callRef.current || !callRef.current.open)) {
              try {
                const mediaCall = peer.call(targetSlot, currentStream);
                setupMediaCall(mediaCall);
              } catch (e) {}
            }
          };

          // Try connection immediately
          tryConnectTarget();

          // And heartbeat retry until media/data connected
          heartbeatInterval = setInterval(() => {
            if (!callRef.current?.open || !dataConnRef.current?.open) {
              tryConnectTarget();
            }
          }, 3000);
        });

        peer.on('connection', (conn) => {
          if (!isSubscribed) return;
          setupDataConnection(conn);
        });

        peer.on('call', (incomingCall) => {
          if (!isSubscribed) return;
          const currentStream = localStreamRef.current || stream;
          if (currentStream) {
            incomingCall.answer(currentStream);
            setupMediaCall(incomingCall);
          } else {
            pendingIncomingCallRef.current = incomingCall;
          }
        });

        peer.on('error', (err: any) => {
          if (!isSubscribed) return;

          if (err.type === 'unavailable-id') {
            // My slot is taken! Switch to the other slot
            peer.destroy();
            if (mySlot === slotA) {
              // Slot A was taken, so I am Slot B (Initiator)
              startPeerInSlot(slotB, slotA, true);
            } else {
              // Both slots taken, fallback guest
              const fallbackSlot = `meet-${cleanRoomCode}-g-${Math.random().toString(36).substring(2, 6)}`;
              startPeerInSlot(fallbackSlot, slotA, true);
            }
          } else if (err.type === 'peer-unavailable') {
            // Target peer not online yet, waiting for friend
          } else {
            console.warn('PeerJS notice:', err?.type || err);
          }
        });
      };

      // Slot A starts as Receiver (isInitiator = false)
      startPeerInSlot(slotA, slotB, false);
    }

    initPeerSession();

    return () => {
      isSubscribed = false;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (callRef.current) callRef.current.close();
      if (dataConnRef.current) dataConnRef.current.close();
      if (peerInstance) peerInstance.destroy();
    };
  }, [roomId]);

  // Network stats polling
  useEffect(() => {
    if (!callRef.current || !callRef.current.peerConnection) return;

    const interval = setInterval(async () => {
      try {
        const pc = callRef.current?.peerConnection;
        if (!pc || pc.connectionState !== 'connected') return;

        const stats = await pc.getStats();
        let bytesReceived = 0;
        let bytesSent = 0;
        let rtt = 0;
        let packetsLost = 0;
        let packetsReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            bytesReceived += report.bytesReceived || 0;
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          } else if (report.type === 'outbound-rtp') {
            bytesSent += report.bytesSent || 0;
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = Math.round((report.currentRoundTripTime || 0) * 1000);
          }
        });

        const now = Date.now();
        const timeDiffSeconds = (now - prevBytesRef.current.timestamp) / 1000;
        const bytesDiff = bytesReceived + bytesSent - prevBytesRef.current.bytes;
        prevBytesRef.current = { bytes: bytesReceived + bytesSent, timestamp: now };

        const currentKbps =
          timeDiffSeconds > 0 ? Math.round(((bytesDiff * 8) / 1000) / timeDiffSeconds) : 0;
        const totalPackets = packetsReceived + packetsLost;
        const lossPercent = totalPackets > 0 ? Math.round((packetsLost / totalPackets) * 100) : 0;

        let rating: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
        if (lossPercent > 10 || rtt > 300) rating = 'poor';
        else if (lossPercent > 5 || rtt > 180) rating = 'fair';
        else if (lossPercent > 2 || rtt > 100) rating = 'good';

        setNetworkStats({
          bytesReceived,
          bytesSent,
          currentKiloBitsPerSecond: Math.max(0, currentKbps),
          packetLossPercentage: lossPercent,
          rttMs: rtt,
          qualityRating: rating,
        });
      } catch (e) {
        // ignore stats errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Controls: Toggle Audio
  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const newState = !isAudioMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !newState;
    });
    setIsAudioMuted(newState);
    playToggleSound(!newState);
    broadcastLocalState({ isAudioMuted: newState });
  }, [localStream, isAudioMuted, broadcastLocalState]);

  // Controls: Toggle Video
  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const newState = !isVideoMuted;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !newState;
    });
    setIsVideoMuted(newState);
    playToggleSound(!newState);
    broadcastLocalState({ isVideoMuted: newState });
  }, [localStream, isVideoMuted, broadcastLocalState]);

  // Controls: Screen Share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      const stream = await initLocalStream(qualityPreset);
      if (stream && callRef.current?.peerConnection) {
        const videoTrack = stream.getVideoTracks()[0];
        const senders = callRef.current.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
      }
      setIsScreenSharing(false);
      broadcastLocalState({ isScreenSharing: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            frameRate: qualityPreset === 'eco' ? 15 : 24,
          } as any,
          audio: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        if (callRef.current?.peerConnection) {
          const senders = callRef.current.peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        broadcastLocalState({ isScreenSharing: true });
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  }, [isScreenSharing, qualityPreset, initLocalStream, broadcastLocalState]);

  // Controls: Change Quality Preset / Data Saver
  const changeQualityPreset = useCallback(
    async (preset: QualityPreset) => {
      setQualityPreset(preset);
      if (callRef.current?.peerConnection) {
        await applyBandwidthConstraints(callRef.current.peerConnection, preset);
      }
      if (!isScreenSharing) {
        await initLocalStream(preset);
      }
      broadcastLocalState({ qualityPreset: preset });
    },
    [isScreenSharing, initLocalStream, broadcastLocalState]
  );

  // Controls: Send Chat Message
  const sendChatMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        senderId: peerId,
        senderName: userName,
        text: text.trim(),
        timestamp: Date.now(),
        isSelf: true,
      };

      setChatMessages((prev) => [...prev, msg]);
      sendData({ type: 'chat', payload: msg });
    },
    [peerId, userName, sendData]
  );

  // Controls: Send Reaction
  const sendReaction = useCallback(
    (emoji: string) => {
      sendData({ type: 'reaction', payload: { emoji } });
    },
    [sendData]
  );

  // Controls: Leave Call
  const leaveCall = useCallback(() => {
    sendData({ type: 'leave', payload: {} });
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    if (dataConnRef.current) {
      dataConnRef.current.close();
      dataConnRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  }, [sendData]);

  return {
    localStream,
    remoteStream,
    peerId,
    remotePeerId,
    remotePeerState,
    remoteAudioLevel,
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
    localAudioLevel,
    chatMessages,
    sendChatMessage,
    sendReaction,
    networkStats,
    selectedAudioDevice,
    selectedVideoDevice,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
  };
}
