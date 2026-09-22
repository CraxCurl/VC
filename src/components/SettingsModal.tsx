'use client';

import { useState, useEffect } from 'react';
import { QualityPreset, QUALITY_PRESETS, NetworkStats } from '@/types/meeting';
import {
  X,
  Mic,
  Video,
  Activity,
  Zap,
  Gauge,
  Wifi,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  qualityPreset: QualityPreset;
  onQualityChange: (preset: QualityPreset) => void;
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
  networkStats: NetworkStats | null;
}

export function SettingsModal({
  isOpen,
  onClose,
  qualityPreset,
  onQualityChange,
  selectedAudioDevice,
  selectedVideoDevice,
  onAudioDeviceChange,
  onVideoDeviceChange,
  networkStats,
}: SettingsModalProps) {
  const [tab, setTab] = useState<'bandwidth' | 'devices' | 'diagnostics'>('bandwidth');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }
    }
    loadDevices();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#202124] border border-[#3c4043] w-full max-w-xl max-h-[90dvh] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#3c4043]">
          <h2 className="text-white font-medium text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#8ab4f8]" /> Call Settings & Data Saver
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#3c4043] bg-[#1a1a1c] px-3 sm:px-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setTab('bandwidth')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'bandwidth'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Data Saver
          </button>
          <button
            onClick={() => setTab('devices')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'devices'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Audio & Video
          </button>
          <button
            onClick={() => setTab('diagnostics')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'diagnostics'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Network Stats
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto">
          {tab === 'bandwidth' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#282a2d] border border-[#3c4043] rounded-xl">
                <div className="flex items-center gap-3 mb-1">
                  <ShieldCheck className="w-5 h-5 text-[#81c995]" />
                  <h3 className="text-white font-medium text-sm">Low Internet Consumption</h3>
                </div>
                <p className="text-xs text-[#9aa0a6] ml-8">
                  Choose a lower quality preset when on mobile data or slow Wi-Fi. Video stream bitrate is automatically constrained in real-time.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((key) => {
                  const preset = QUALITY_PRESETS[key];
                  const isSelected = qualityPreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => onQualityChange(key)}
                      className={`p-4 rounded-xl border text-left flex items-start justify-between transition-all ${
                        isSelected
                          ? 'border-[#8ab4f8] bg-[#8ab4f8]/10 text-white ring-1 ring-[#8ab4f8]'
                          : 'border-[#3c4043] bg-[#282a2d] text-[#e8eaed] hover:border-[#5f6368]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{preset.label}</span>
                          {key === 'eco' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#81c995]/20 text-[#81c995] border border-[#81c995]/40">
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9aa0a6] mt-1">{preset.description}</p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center mt-1 ${
                          isSelected ? 'border-[#8ab4f8] bg-[#8ab4f8]' : 'border-[#5f6368]'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#202124]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'devices' && (
            <div className="space-y-5">
              {/* Microphone */}
              <div>
                <label className="block text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#8ab4f8]" /> Microphone
                </label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => onAudioDeviceChange(e.target.value)}
                  className="w-full bg-[#303134] text-white border border-[#3c4043] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#8ab4f8]"
                >
                  <option value="">Default Microphone</option>
                  {audioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera */}
              <div>
                <label className="block text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#8ab4f8]" /> Camera
                </label>
                <select
                  value={selectedVideoDevice}
                  onChange={(e) => onVideoDeviceChange(e.target.value)}
                  className="w-full bg-[#303134] text-white border border-[#3c4043] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#8ab4f8]"
                >
                  <option value="">Default Camera</option>
                  {videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#282a2d] border border-[#3c4043] rounded-xl p-4">
                  <div className="text-xs text-[#9aa0a6] flex items-center gap-1.5 mb-1">
                    <Gauge className="w-4 h-4 text-[#8ab4f8]" /> Current Bitrate
                  </div>
                  <div className="text-xl font-bold text-white">
                    {networkStats ? `${networkStats.currentKiloBitsPerSecond} kbps` : '--'}
                  </div>
                  <div className="text-[11px] text-[#9aa0a6] mt-1">Real-time bandwidth usage</div>
                </div>

                <div className="bg-[#282a2d] border border-[#3c4043] rounded-xl p-4">
                  <div className="text-xs text-[#9aa0a6] flex items-center gap-1.5 mb-1">
                    <Wifi className="w-4 h-4 text-[#81c995]" /> Latency (RTT)
                  </div>
                  <div className="text-xl font-bold text-white">
                    {networkStats ? `${networkStats.rttMs} ms` : '--'}
                  </div>
                  <div className="text-[11px] text-[#9aa0a6] mt-1">Round trip time</div>
                </div>

                <div className="bg-[#282a2d] border border-[#3c4043] rounded-xl p-4">
                  <div className="text-xs text-[#9aa0a6] flex items-center gap-1.5 mb-1">
                    <Activity className="w-4 h-4 text-[#f28b82]" /> Packet Loss
                  </div>
                  <div className="text-xl font-bold text-white">
                    {networkStats ? `${networkStats.packetLossPercentage}%` : '0%'}
                  </div>
                  <div className="text-[11px] text-[#9aa0a6] mt-1">Connection reliability</div>
                </div>

                <div className="bg-[#282a2d] border border-[#3c4043] rounded-xl p-4">
                  <div className="text-xs text-[#9aa0a6] flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-[#fbbc04]" /> Quality Rating
                  </div>
                  <div className="text-xl font-bold text-[#81c995] capitalize">
                    {networkStats ? networkStats.qualityRating : 'Optimal'}
                  </div>
                  <div className="text-[11px] text-[#9aa0a6] mt-1">Peer-to-peer status</div>
                </div>
              </div>

              <div className="p-3 bg-[#1a1a1c] rounded-xl border border-[#3c4043] text-xs text-[#9aa0a6] leading-relaxed">
                💡 WebRTC streams directly between the two browsers with encrypted SRTP/DTLS. No intermediary server stores or processes your video.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#3c4043] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-semibold hover:bg-[#aecbfa] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
