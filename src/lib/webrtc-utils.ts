import { QUALITY_PRESETS, QualityPreset } from '@/types/meeting';

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
      }
    : {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

  if (preset === 'audio-only') {
    return {
      audio: audioConstraint,
      video: false,
    };
  }

  const videoConstraint: MediaTrackConstraints = {
    width: { ideal: config.width || 640 },
    height: { ideal: config.height || 480 },
    frameRate: { ideal: config.frameRate || 24 },
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
          // Pause/degrade video encoding
          parameters.encodings[0].active = false;
        } else {
          parameters.encodings[0].active = true;
          parameters.encodings[0].maxBitrate = config.videoBitrateKbps * 1000;
          parameters.encodings[0].maxFramerate = config.frameRate;
          if (preset === 'eco') {
            parameters.encodings[0].scaleResolutionDownBy = 2;
          } else {
            parameters.encodings[0].scaleResolutionDownBy = 1;
          }
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

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      const isSpeaking = normalized > 12 && audioTrack.enabled;

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
