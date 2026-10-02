'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QualityPreset } from '@/types/meeting';
import { Lobby } from '@/components/Lobby';
import { MeetingRoom } from '@/components/MeetingRoom';
import { SettingsModal } from '@/components/SettingsModal';
import { DroneController } from '@/components/DroneController';

function MeetAppContent() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room') || '';
  const modeParam = searchParams.get('mode');

  // Mode Selection: 'normal' (Video Meeting) vs 'esp32' (ESP32 Drone Bridge)
  const [appMode, setAppMode] = useState<'normal' | 'esp32'>('normal');

  const [inMeeting, setInMeeting] = useState(false);
  const [meetingConfig, setMeetingConfig] = useState<{
    roomId: string;
    userName: string;
    qualityPreset: QualityPreset;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  }>({
    roomId: roomParam,
    userName: '',
    qualityPreset: 'eco', // Default to Eco (Data Saver) for low net usage
    isAudioMuted: false,
    isVideoMuted: false,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');

  // Update room ID or mode if URL query param changes
  useEffect(() => {
    if (roomParam) {
      setMeetingConfig((prev) => ({ ...prev, roomId: roomParam }));
    }
    if (modeParam === 'esp32') {
      setAppMode('esp32');
    }
  }, [roomParam, modeParam]);

  const handleJoinRoom = (config: {
    roomId: string;
    userName: string;
    qualityPreset: QualityPreset;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  }) => {
    setMeetingConfig(config);
    setInMeeting(true);
  };

  const handleLeaveMeeting = () => {
    setInMeeting(false);
  };

  const handleQualityChange = (preset: QualityPreset) => {
    setMeetingConfig((prev) => ({ ...prev, qualityPreset: preset }));
  };

  // If ESP32 Drone mode is active
  if (appMode === 'esp32') {
    return <DroneController onSwitchMode={() => setAppMode('normal')} />;
  }

  return (
    <div className="min-h-screen bg-[#131314]">
      {!inMeeting ? (
        <>
          <Lobby
            onJoinRoom={handleJoinRoom}
            initialRoomId={roomParam || meetingConfig.roomId}
            onOpenSettings={() => setIsSettingsOpen(true)}
            qualityPreset={meetingConfig.qualityPreset}
            onQualityChange={handleQualityChange}
            onSelectEsp32Mode={() => setAppMode('esp32')}
          />
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            qualityPreset={meetingConfig.qualityPreset}
            onQualityChange={handleQualityChange}
            selectedAudioDevice={selectedAudioDevice}
            selectedVideoDevice={selectedVideoDevice}
            onAudioDeviceChange={setSelectedAudioDevice}
            onVideoDeviceChange={setSelectedVideoDevice}
            networkStats={null}
          />
        </>
      ) : (
        <MeetingRoom
          roomId={meetingConfig.roomId}
          userName={meetingConfig.userName || 'You'}
          initialPreset={meetingConfig.qualityPreset}
          initialAudioMuted={meetingConfig.isAudioMuted}
          initialVideoMuted={meetingConfig.isVideoMuted}
          onLeave={handleLeaveMeeting}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#131314] flex items-center justify-center text-white">
          <div className="w-8 h-8 rounded-full border-2 border-[#8ab4f8] border-t-transparent animate-spin" />
        </div>
      }
    >
      <MeetAppContent />
    </Suspense>
  );
}
