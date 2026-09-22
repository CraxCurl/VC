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
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const prevBytesRef = useRef<{ bytes: number; timestamp: number }>({ bytes: 0, timestamp: Date.now() });

  // Keep ref synchronized
  useEffect(() => {
    localStreamRef.current = localStream;
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
      dataConnRef.current.send(payload);
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
  const initLocalStream = useCallback(async (preset: QualityPreset = initialPreset, aDevId?: string, vDevId?: string) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = getMediaConstraints(preset, aDevId || selectedAudioDevice, vDevId || selectedVideoDevice);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply initial mute states
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !initialAudioMuted;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = !initialVideoMuted;
      });

      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.warn('Fallback to standard getUserMedia:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        return stream;
      } catch (audioErr) {
        setConnectionError('Could not access camera or microphone. Please check browser permissions.');
        return null;
      }
    }
  }, [initialAudioMuted, initialVideoMuted, selectedAudioDevice, selectedVideoDevice, initialPreset]);

  // Setup Data Connection Listeners
  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;

    conn.on('open', () => {
      setIsConnected(true);
      broadcastLocalState();
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
  }, [broadcastLocalState, onReactionReceived, onRemoteLeft]);

  // Setup Media Call Listeners
  const setupMediaCall = useCallback((call: MediaConnection) => {
    callRef.current = call;

    call.on('stream', (rStream) => {
      setRemoteStream(rStream);
      setIsConnected(true);
      setRemotePeerId(call.peer);
      playJoinSound();
      if (onRemoteJoined) onRemoteJoined();

      if (call.peerConnection) {
        applyBandwidthConstraints(call.peerConnection, qualityPreset);
      }
    });

    call.on('close', () => {
      setRemoteStream(null);
      setRemotePeerId(null);
      setRemotePeerState(null);
      setIsConnected(false);
      playLeaveSound();
      if (onRemoteLeft) onRemoteLeft();
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
    });
  }, [qualityPreset, onRemoteJoined, onRemoteLeft]);

  // Connect to target Peer ID
  const connectToPeer = useCallback((targetPeerId: string) => {
    if (!peerRef.current || !localStreamRef.current) return;
    if (targetPeerId === peerRef.current.id) return;

    try {
      const dataConn = peerRef.current.connect(targetPeerId);
      setupDataConnection(dataConn);

      const mediaCall = peerRef.current.call(targetPeerId, localStreamRef.current);
      setupMediaCall(mediaCall);
    } catch (err) {
      console.warn('Connect to peer attempt:', err);
    }
  }, [setupDataConnection, setupMediaCall]);

  // Initialize WebRTC & Deterministic 1-on-1 Room Peer Matching
  useEffect(() => {
    let peerInstance: Peer | null = null;
    let isSubscribed = true;
    let connectInterval: NodeJS.Timeout | null = null;

    const cleanRoomCode = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hostPeerId = `meet-${cleanRoomCode}-host`;
    const guestPeerId = `meet-${cleanRoomCode}-guest`;

    async function initPeerSession() {
      setIsConnecting(true);
      const stream = await initLocalStream(qualityPreset);

      if (!isSubscribed) return;

      const { default: Peer } = await import('peerjs');

      const peerConfig = {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      };

      // Try Host ID first
      let currentPeer = new Peer(hostPeerId, peerConfig);
      peerInstance = currentPeer;
      peerRef.current = currentPeer;

      const attachHandlers = (peer: Peer, isHost: boolean) => {
        peer.on('open', (id) => {
          if (!isSubscribed) return;
          setPeerId(id);
          setIsConnecting(false);

          if (!isHost) {
            // As guest, connect to host immediately
            if (stream) {
              const dataConn = peer.connect(hostPeerId);
              setupDataConnection(dataConn);

              const mediaCall = peer.call(hostPeerId, stream);
              setupMediaCall(mediaCall);
            }
          } else {
            // As host, also attempt periodic handshake if guest joins
            connectInterval = setInterval(() => {
              if (!callRef.current && peerRef.current && stream) {
                // Host ping to guest
                try {
                  const dataConn = peer.connect(guestPeerId);
                  setupDataConnection(dataConn);
                } catch (e) {}
              }
            }, 3000);
          }
        });

        peer.on('connection', (conn) => {
          setupDataConnection(conn);
        });

        peer.on('call', (incomingCall) => {
          if (localStreamRef.current) {
            incomingCall.answer(localStreamRef.current);
            setupMediaCall(incomingCall);
          }
        });

        peer.on('error', (err: any) => {
          if (err.type === 'unavailable-id' && isHost) {
            // Host is taken! We are the Guest. Connect as Guest ID.
            peer.destroy();
            const guestPeer = new Peer(guestPeerId, peerConfig);
            peerInstance = guestPeer;
            peerRef.current = guestPeer;
            attachHandlers(guestPeer, false);
          } else if (err.type === 'peer-unavailable') {
            // Remote peer not online yet, waiting in lobby
          } else {
            console.warn('PeerJS notice:', err);
          }
        });
      };

      attachHandlers(currentPeer, true);
    }

    initPeerSession();

    return () => {
      isSubscribed = false;
      if (connectInterval) clearInterval(connectInterval);
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
        const bytesDiff = (bytesReceived + bytesSent) - prevBytesRef.current.bytes;
        prevBytesRef.current = { bytes: bytesReceived + bytesSent, timestamp: now };

        const currentKbps = timeDiffSeconds > 0 ? Math.round((bytesDiff * 8) / 1000 / timeDiffSeconds) : 0;
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
            frameRate: qualityPreset === 'eco' ? 15 : 30,
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
      playMessageSound();
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
    if (callRef.current) callRef.current.close();
    if (dataConnRef.current) dataConnRef.current.close();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
    }
    setIsConnected(false);
    setRemoteStream(null);
    setRemotePeerId(null);
    setRemotePeerState(null);
  }, [sendData]);

  return {
    localStream,
    remoteStream,
    selectedAudioDevice,
    selectedVideoDevice,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
    initLocalStream,

    peerId,
    remotePeerId,
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

    localAudioLevel,
    isLocalSpeaking,
    remoteAudioLevel,

    chatMessages,
    sendChatMessage,
    sendReaction,
    networkStats,
  };
}
