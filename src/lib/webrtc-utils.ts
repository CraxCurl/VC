import { QUALITY_PRESETS, QualityPreset } from '@/types/meeting';

export const ICE_SERVERS: RTCIceServer[] = [
  // Google Public STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Cloudflare Public STUN
  { urls: 'stun:stun.cloudflare.com:3478' },
  // Twilio Public STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
  // OpenRelay Public STUN & TURN fallback (for Symmetric NAT / mobile carrier networks)
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segment = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

export function getMediaConstraints(
  preset: QualityPreset,
  audioDeviceId?: string,
  videoDeviceId?: string
): MediaStreamConstraints {
  const config = QUALITY_PRESETS[preset];

  const audioConstraint: MediaTrackConstraints | boolean = audioDeviceId
    ? {
        deviceId: { exact: audioDeviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // Mono audio cuts voice data consumption in half
      }
    : {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      };

  if (preset === 'audio-only') {
    return {
      audio: audioConstraint,
      video: false,
    };
  }

  const videoConstraint: MediaTrackConstraints = {
    width: { ideal: config.width || 480 },
    height: { ideal: config.height || 360 },
    frameRate: { ideal: config.frameRate || 15 },
    facingMode: 'user',
    ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
  };

  return {
    audio: audioConstraint,
    video: videoConstraint,
  };
}

/**
 * Dynamically updates RTCRtpSender encodings to cap video/audio bitrate for low data consumption.
 */
export async function applyBandwidthConstraints(
  peerConnection: RTCPeerConnection | undefined,
  preset: QualityPreset
) {
  if (!peerConnection) return;
  const config = QUALITY_PRESETS[preset];

  try {
    const senders = peerConnection.getSenders();
    for (const sender of senders) {
      if (!sender.track) continue;

      if (sender.track.kind === 'video') {
        const parameters = sender.getParameters();
        if (!parameters.encodings || parameters.encodings.length === 0) {
          parameters.encodings = [{}];
        }

        if (preset === 'audio-only') {
          parameters.encodings[0].active = false;
        } else {
          parameters.encodings[0].active = true;
          // Set clean max bitrate without fractional scale degradation
          parameters.encodings[0].maxBitrate = config.videoBitrateKbps * 1000;
          parameters.encodings[0].maxFramerate = config.frameRate;
        }
        await sender.setParameters(parameters);
      }

      if (sender.track.kind === 'audio') {
        const parameters = sender.getParameters();
        if (!parameters.encodings || parameters.encodings.length === 0) {
          parameters.encodings = [{}];
        }
        parameters.encodings[0].maxBitrate = config.audioBitrateKbps * 1000;
        await sender.setParameters(parameters);
      }
    }
  } catch (err) {
    console.warn('Could not apply bandwidth limits:', err);
  }
}

/**
 * Creates an audio volume level monitor using Web Audio API
 */
export function createAudioLevelMonitor(
  stream: MediaStream,
  onLevelChange: (volume: number, isSpeaking: boolean) => void
): () => void {
  let isCancelled = false;
  let audioCtx: AudioContext | null = null;
  let animFrameId: number | null = null;

  try {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return () => {};

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return () => {};

    audioCtx = new AudioContextClass();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (isCancelled) return;
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalized = Math.min(100, Math.round((average / 128) * 100));
      const isSpeaking = normalized > 10 && audioTrack.enabled;

      onLevelChange(normalized, isSpeaking);
      animFrameId = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  } catch (err) {
    console.warn('Audio level monitor error:', err);
  }

  return () => {
    isCancelled = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  };
}
