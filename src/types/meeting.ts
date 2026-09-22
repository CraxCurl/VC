export type QualityPreset = 'eco' | 'balanced' | 'hd' | 'audio-only';

export interface QualityConfig {
  name: string;
  label: string;
  description: string;
  width: number;
  height: number;
  frameRate: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  'eco': {
    name: 'eco',
    label: 'Data Saver (Eco)',
    description: '360p @ 15fps (~180-250 kbps) - Lowest internet usage',
    width: 480,
    height: 360,
    frameRate: 15,
    videoBitrateKbps: 200,
    audioBitrateKbps: 24,
  },
  'balanced': {
    name: 'balanced',
    label: 'Balanced',
    description: '480p @ 24fps (~500 kbps) - Good balance',
    width: 640,
    height: 480,
    frameRate: 24,
    videoBitrateKbps: 500,
    audioBitrateKbps: 32,
  },
  'hd': {
    name: 'hd',
    label: 'High Definition',
    description: '720p @ 30fps (~1.2 Mbps) - Crisp video',
    width: 1280,
    height: 720,
    frameRate: 30,
    videoBitrateKbps: 1200,
    audioBitrateKbps: 64,
  },
  'audio-only': {
    name: 'audio-only',
    label: 'Audio Only',
    description: 'Voice only (~24 kbps) - Minimal data',
    width: 0,
    height: 0,
    frameRate: 0,
    videoBitrateKbps: 0,
    audioBitrateKbps: 24,
  },
};

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
}

export interface PeerDataPayload {
  type: 'chat' | 'reaction' | 'state-sync' | 'leave';
  payload: any;
}

export interface PeerState {
  name: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  qualityPreset: QualityPreset;
  isSpeaking: boolean;
}

export interface NetworkStats {
  bytesReceived: number;
  bytesSent: number;
  currentKiloBitsPerSecond: number;
  packetLossPercentage: number;
  rttMs: number;
  qualityRating: 'excellent' | 'good' | 'fair' | 'poor';
}
