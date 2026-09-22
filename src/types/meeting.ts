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
    label: 'Ultra Data Saver',
    description: '240p/360p @ 15fps (~140-160 kbps) - ~1MB/min lowest internet usage',
    width: 360,
    height: 270,
    frameRate: 15,
    videoBitrateKbps: 140,
    audioBitrateKbps: 18,
  },
  'balanced': {
    name: 'balanced',
    label: 'Balanced',
    description: '480p @ 20fps (~350 kbps) - ~2.8MB/min smooth & clear',
    width: 640,
    height: 480,
    frameRate: 20,
    videoBitrateKbps: 350,
    audioBitrateKbps: 24,
  },
  'hd': {
    name: 'hd',
    label: 'High Definition',
    description: '720p @ 25fps (~700 kbps) - HD video',
    width: 960,
    height: 540,
    frameRate: 25,
    videoBitrateKbps: 700,
    audioBitrateKbps: 32,
  },
  'audio-only': {
    name: 'audio-only',
    label: 'Audio Only',
    description: 'Voice only (~16 kbps) - Ultra-light voice call',
    width: 0,
    height: 0,
    frameRate: 0,
    videoBitrateKbps: 0,
    audioBitrateKbps: 16,
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
