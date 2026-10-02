'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wifi,
  Bluetooth,
  Radio,
  Plane,
  AlertTriangle,
  Play,
  Square,
  Compass,
  Gauge,
  Sliders,
  Terminal,
  RefreshCw,
  Video,
  Eye,
  EyeOff,
  Keyboard,
  Power,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Zap,
  Info,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

interface DroneControllerProps {
  onSwitchMode: () => void;
}

interface LogEntry {
  id: string;
  time: string;
  type: 'sent' | 'received' | 'info' | 'error';
  text: string;
}

export function DroneController({ onSwitchMode }: DroneControllerProps) {
  // Serial / Bluetooth State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [portName, setPortName] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [customCmd, setCustomCmd] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  // Flight Telemetry States (Center = 128)
  const [throttle, setThrottle] = useState(128); // 0 - 255
  const [yaw, setYaw] = useState(128);           // 0 - 255
  const [pitch, setPitch] = useState(128);       // 0 - 255
  const [roll, setRoll] = useState(128);         // 0 - 255
  const [flightState, setFlightState] = useState<'DISARMED' | 'ARMED' | 'FLYING' | 'EMERGENCY'>('DISARMED');
  const [heartbeatCount, setHeartbeatCount] = useState(0);

  // Video / FPV Stream
  const [streamUrl, setStreamUrl] = useState('http://192.168.4.1:8080/?action=stream');
  const [showVideo, setShowVideo] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Pressed Keys Visualizer
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  // Web Serial References
  const serialPortRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const keepReadingRef = useRef(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Add Log helper
  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [...prev.slice(-80), { id: Math.random().toString(36).substring(2, 9), time, type, text }]);
  }, []);

  // Auto-scroll log container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Connect to ESP32 over Web Serial (Bluetooth SPP / Virtual COM Port)
  const handleConnectSerial = async () => {
    if (!('serial' in navigator)) {
      addLog('Web Serial API is not supported in this browser. Please use Chrome or Edge.', 'error');
      alert('Web Serial API is not supported on this browser. Please use Google Chrome or Microsoft Edge on Desktop/Android.');
      return;
    }

    try {
      setIsConnecting(true);
      addLog('Opening serial device selection prompt...', 'info');

      // Request port from user
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });

      serialPortRef.current = port;
      setPortName('ESP32_Drone (COM)');
      setIsConnected(true);
      setIsConnecting(false);
      addLog('Successfully connected to ESP32 via Serial/Bluetooth!', 'info');

      // Setup writer
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      writerRef.current = textEncoder.writable.getWriter();

      // Setup reader
      keepReadingRef.current = true;
      readSerialLoop(port);
    } catch (err: any) {
      setIsConnecting(false);
      setIsConnected(false);
      addLog(`Connection failed or cancelled: ${err.message || err}`, 'error');
    }
  };

  // Read loop from Serial
  const readSerialLoop = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              addLog(`ESP32: ${trimmed}`, 'received');
              if (trimmed.includes('TAKEOFF')) setFlightState('FLYING');
              if (trimmed.includes('LAND') || trimmed.includes('STOP')) setFlightState('DISARMED');
            }
          }
        }
      }
    } catch (err: any) {
      if (keepReadingRef.current) {
        addLog(`Serial read error: ${err.message || err}`, 'error');
      }
    } finally {
      reader.releaseLock();
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current) await readerRef.current.cancel();
      if (writerRef.current) await writerRef.current.close();
      if (serialPortRef.current) await serialPortRef.current.close();
    } catch (e) {
      console.warn('Disconnect cleanup error:', e);
    }
    serialPortRef.current = null;
    setIsConnected(false);
    setPortName(null);
    setFlightState('DISARMED');
    addLog('Disconnected from ESP32.', 'info');
  };

  // Send raw string over Serial
  const sendSerialCommand = async (cmd: string, displayLabel?: string) => {
    if (!writerRef.current || !isConnected) {
      addLog(`[Simulation] ${displayLabel || cmd}`, 'sent');
      return;
    }
    try {
      await writerRef.current.write(cmd.endsWith('\n') ? cmd : cmd + '\n');
      addLog(`Sent: ${displayLabel || cmd}`, 'sent');
    } catch (err: any) {
      addLog(`Failed to write command: ${err.message || err}`, 'error');
    }
  };

  // Flight Controls
  const handleTakeoff = () => {
    setFlightState('FLYING');
    sendSerialCommand('t', 'TAKEOFF (0x01)');
  };

  const handleLand = () => {
    setFlightState('DISARMED');
    sendSerialCommand('l', 'LAND (0x02)');
  };

  const handleEmergencyStop = () => {
    setFlightState('EMERGENCY');
    setThrottle(0);
    sendSerialCommand('s', 'EMERGENCY STOP (0x04)');
  };

  const handleCalibrate = () => {
    sendSerialCommand('c', 'GYRO CALIBRATION (0x08)');
  };

  const handleHandshake = () => {
    sendSerialCommand('h', 'RE-SEND HANDSHAKE (0x42, 0x76)');
  };

  // Send manual Parametric packet (P,roll,pitch,throttle,yaw,cmd)
  const sendParametricState = useCallback((r: number, p: number, t: number, y: number, cmd = 0) => {
    if (isConnected && writerRef.current) {
      const packetStr = `P,${Math.round(r)},${Math.round(p)},${Math.round(t)},${Math.round(y)},${cmd}\n`;
      writerRef.current.write(packetStr).catch(() => {});
    }
  }, [isConnected]);

  // Periodic Heartbeat counter for UI
  useEffect(() => {
    const timer = setInterval(() => {
      setHeartbeatCount((c) => (c + 1) % 9999);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard Flight Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      const key = e.key.toLowerCase();
      setActiveKeys((prev) => new Set(prev).add(key));

      if (key === 't') {
        e.preventDefault();
        handleTakeoff();
      } else if (key === 'l') {
        e.preventDefault();
        handleLand();
      } else if (key === ' ' || key === 'escape') {
        e.preventDefault();
        handleEmergencyStop();
      } else if (key === 'c') {
        e.preventDefault();
        handleCalibrate();
      } else if (key === 'h') {
        e.preventDefault();
        handleHandshake();
      } else if (key === 'w') {
        // Throttle UP
        setThrottle((prev) => {
          const next = Math.min(255, prev + 15);
          sendParametricState(roll, pitch, next, yaw);
          return next;
        });
      } else if (key === 's') {
        // Throttle DOWN
        setThrottle((prev) => {
          const next = Math.max(0, prev - 15);
          sendParametricState(roll, pitch, next, yaw);
          return next;
        });
      } else if (key === 'a') {
        // Yaw LEFT
        setYaw(80);
        sendParametricState(roll, pitch, throttle, 80);
      } else if (key === 'd') {
        // Yaw RIGHT
        setYaw(176);
        sendParametricState(roll, pitch, throttle, 176);
      } else if (key === 'arrowup' || key === 'i') {
        // Pitch FORWARD
        setPitch(180);
        sendParametricState(roll, 180, throttle, yaw);
      } else if (key === 'arrowdown' || key === 'k') {
        // Pitch BACKWARD
        setPitch(76);
        sendParametricState(roll, 76, throttle, yaw);
      } else if (key === 'arrowleft' || key === 'j') {
        // Roll LEFT
        setRoll(76);
        sendParametricState(76, pitch, throttle, yaw);
      } else if (key === 'arrowright' || key === 'l') {
        // Roll RIGHT
        setRoll(180);
        sendParametricState(180, pitch, throttle, yaw);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      // Reset directional sticks back to center on key release
      if (['a', 'd'].includes(key)) {
        setYaw(128);
        sendParametricState(roll, pitch, throttle, 128);
      }
      if (['arrowup', 'arrowdown', 'i', 'k'].includes(key)) {
        setPitch(128);
        sendParametricState(roll, 128, throttle, yaw);
      }
      if (['arrowleft', 'arrowright', 'j', 'l'].includes(key)) {
        setRoll(128);
        sendParametricState(128, pitch, throttle, yaw);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [throttle, yaw, pitch, roll, sendParametricState]);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#e1e7ec] flex flex-col font-mono selection:bg-[#00e5ff]/20">
      {/* Top Cockpit Header Bar */}
      <header className="border-b border-[#1b2533] bg-[#0d131c]/90 backdrop-blur px-6 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#0055ff] to-[#00e5ff] flex items-center justify-center shadow-lg shadow-[#00e5ff]/20">
              <Radio className="w-5 h-5 text-black animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wider text-white flex items-center gap-2">
                AERO-LINK <span className="text-[10px] px-2 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30">ESP32 BRIDGE</span>
              </h1>
              <p className="text-xs text-gray-400">E88 / JY-UFO Quadcopter Flight Control</p>
            </div>
          </div>

          {/* Connection Status Badges */}
          <div className="hidden md:flex items-center gap-2.5 ml-4 border-l border-[#1f2d3d] pl-4">
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              isConnected 
                ? 'bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/40' 
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              <Bluetooth className={`w-3.5 h-3.5 ${isConnected ? 'animate-bounce' : ''}`} />
              {isConnected ? (portName || 'BLUETOOTH LINKED') : 'BT DISCONNECTED'}
            </div>

            <div className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30">
              <Wifi className="w-3.5 h-3.5" />
              DRONE UDP :8090
            </div>

            <div className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-[#8ab4f8]/10 text-[#8ab4f8] border border-[#8ab4f8]/30">
              <Zap className="w-3.5 h-3.5" />
              25Hz HEARTBEAT #{heartbeatCount}
            </div>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInstructions(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a2332] text-gray-300 hover:bg-[#253245] hover:text-white border border-[#2c3d53] transition"
            title="ESP32 Code & Setup Instructions"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#00e5ff]" />
            <span>ESP32 Setup</span>
          </button>

          {!isConnected ? (
            <button
              onClick={handleConnectSerial}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#00e5ff] to-[#0077ff] text-black hover:opacity-90 transition shadow-lg shadow-[#00e5ff]/20 cursor-pointer disabled:opacity-50"
            >
              <Bluetooth className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : 'Connect ESP32 (BT)'}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              Disconnect
            </button>
          )}

          {/* Mode Switch Button */}
          <button
            onClick={onSwitchMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e293b] text-gray-300 hover:bg-[#334155] hover:text-white border border-[#334155] transition"
          >
            <Video className="w-3.5 h-3.5 text-indigo-400" />
            <span>Switch to Video Meeting</span>
          </button>
        </div>
      </header>

      {/* Main Cockpit Grid */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1800px] w-full mx-auto">
        
        {/* Left Column: Flight Instruments & Telemetry (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Artificial Horizon / Attitude Visualizer */}
          <div className="bg-[#0e1622] rounded-xl border border-[#1b2838] p-4 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-widest text-[#00e5ff] font-bold flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> Flight Attitude Indicator
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                flightState === 'FLYING' ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40' :
                flightState === 'EMERGENCY' ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' :
                'bg-gray-800 text-gray-400'
              }`}>
                {flightState}
              </span>
            </div>

            {/* Circular Horizon Gauge */}
            <div className="relative w-48 h-48 mx-auto rounded-full border-4 border-[#1b2838] overflow-hidden bg-gradient-to-b from-[#1b3b5f] to-[#3a2613] flex items-center justify-center shadow-inner">
              {/* Pitch Ladder Line */}
              <div 
                className="absolute inset-0 flex items-center justify-center transition-transform duration-100 ease-out"
                style={{
                  transform: `rotate(${((roll - 128) / 128) * 35}deg) translateY(${((pitch - 128) / 128) * -30}px)`
                }}
              >
                <div className="w-full h-0.5 bg-[#00e5ff] relative shadow-[0_0_8px_#00e5ff]">
                  <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-4 h-4 border-2 border-[#00e5ff] rounded-full" />
                  <div className="absolute left-4 -top-3 text-[9px] text-[#00e5ff] font-mono">+10°</div>
                  <div className="absolute right-4 -top-3 text-[9px] text-[#00e5ff] font-mono">+10°</div>
                  <div className="absolute left-4 top-1 text-[9px] text-[#00e5ff] font-mono">-10°</div>
                  <div className="absolute right-4 top-1 text-[9px] text-[#00e5ff] font-mono">-10°</div>
                </div>
              </div>

              {/* Fixed Aircraft Crosshair Reference */}
              <div className="absolute pointer-events-none flex items-center justify-center">
                <div className="w-8 h-1 bg-[#ffcc00] rounded" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-[#ffcc00] bg-black/40 mx-1" />
                <div className="w-8 h-1 bg-[#ffcc00] rounded" />
              </div>
            </div>

            {/* Telemetry Numbers Grid */}
            <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[#1b2838] text-center">
              <div className="bg-[#090e15] p-2 rounded border border-[#1b2533]">
                <div className="text-[10px] text-gray-400">THROTTLE</div>
                <div className="text-sm font-bold text-[#00e5ff]">{Math.round((throttle / 255) * 100)}%</div>
                <div className="text-[9px] text-gray-500">RAW: {throttle}</div>
              </div>
              <div className="bg-[#090e15] p-2 rounded border border-[#1b2533]">
                <div className="text-[10px] text-gray-400">PITCH</div>
                <div className="text-sm font-bold text-white">{pitch - 128}</div>
                <div className="text-[9px] text-gray-500">RAW: {pitch}</div>
              </div>
              <div className="bg-[#090e15] p-2 rounded border border-[#1b2533]">
                <div className="text-[10px] text-gray-400">ROLL</div>
                <div className="text-sm font-bold text-white">{roll - 128}</div>
                <div className="text-[9px] text-gray-500">RAW: {roll}</div>
              </div>
              <div className="bg-[#090e15] p-2 rounded border border-[#1b2533]">
                <div className="text-[10px] text-gray-400">YAW</div>
                <div className="text-sm font-bold text-white">{yaw - 128}</div>
                <div className="text-[9px] text-gray-500">RAW: {yaw}</div>
              </div>
            </div>
          </div>

          {/* Quick Action Commands (Takeoff, Land, Stop, Calibrate) */}
          <div className="bg-[#0e1622] rounded-xl border border-[#1b2838] p-4 shadow-xl">
            <h2 className="text-xs uppercase tracking-widest text-[#00e5ff] font-bold mb-3 flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Flight Command Station
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {/* Takeoff */}
              <button
                onClick={handleTakeoff}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-gradient-to-b from-[#00b0ff]/20 to-[#0077ff]/10 border border-[#00e5ff]/40 text-[#00e5ff] hover:bg-[#00e5ff]/20 hover:border-[#00e5ff] active:scale-95 transition group cursor-pointer shadow-lg"
              >
                <div className="w-8 h-8 rounded-full bg-[#00e5ff]/20 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                  <Plane className="w-4 h-4 text-[#00e5ff]" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Takeoff</span>
                <span className="text-[10px] text-gray-400 font-mono mt-0.5">[Key: T]</span>
              </button>

              {/* Land */}
              <button
                onClick={handleLand}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-gradient-to-b from-[#ffaa00]/20 to-[#ff7700]/10 border border-[#ffaa00]/40 text-[#ffaa00] hover:bg-[#ffaa00]/20 hover:border-[#ffaa00] active:scale-95 transition group cursor-pointer shadow-lg"
              >
                <div className="w-8 h-8 rounded-full bg-[#ffaa00]/20 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                  <ArrowDown className="w-4 h-4 text-[#ffaa00]" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Land</span>
                <span className="text-[10px] text-gray-400 font-mono mt-0.5">[Key: L]</span>
              </button>

              {/* Gyro Calibrate */}
              <button
                onClick={handleCalibrate}
                className="flex items-center justify-center gap-2 p-3 rounded-lg bg-[#141e2c] border border-[#203043] text-gray-200 hover:bg-[#1b283b] hover:text-white active:scale-95 transition cursor-pointer text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#00ff88]" />
                <span>Calibrate [C]</span>
              </button>

              {/* Handshake */}
              <button
                onClick={handleHandshake}
                className="flex items-center justify-center gap-2 p-3 rounded-lg bg-[#141e2c] border border-[#203043] text-gray-200 hover:bg-[#1b283b] hover:text-white active:scale-95 transition cursor-pointer text-xs font-semibold"
              >
                <Zap className="w-3.5 h-3.5 text-[#ffcc00]" />
                <span>Handshake [H]</span>
              </button>
            </div>

            {/* Emergency STOP Button */}
            <button
              onClick={handleEmergencyStop}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition shadow-lg shadow-red-600/30 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              EMERGENCY KILL STOP [SPACE / ESC]
            </button>
          </div>
        </div>

        {/* Center Column: Interactive Flight Sticks & Video (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* FPV Video / Camera Feed Box */}
          <div className="bg-[#0e1622] rounded-xl border border-[#1b2838] p-4 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs uppercase tracking-widest text-[#00e5ff] font-bold flex items-center gap-1.5">
                <Video className="w-4 h-4" /> Live FPV Feed (Drone Wi-Fi AP)
              </h2>
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="text-[11px] px-2.5 py-1 rounded bg-[#1b2838] hover:bg-[#25364b] text-gray-300 flex items-center gap-1 transition cursor-pointer"
              >
                {showVideo ? <EyeOff className="w-3 h-3 text-red-400" /> : <Eye className="w-3 h-3 text-[#00e5ff]" />}
                {showVideo ? 'Hide Stream' : 'Open Stream'}
              </button>
            </div>

            <div className="relative aspect-video rounded-lg bg-black border border-[#1b2838] overflow-hidden flex items-center justify-center">
              {showVideo ? (
                <img
                  src={streamUrl}
                  alt="Drone FPV Stream"
                  className="w-full h-full object-cover"
                  onError={() => setCameraError(true)}
                  onLoad={() => setCameraError(false)}
                />
              ) : (
                <div className="text-center p-6 text-gray-500 flex flex-col items-center">
                  <Video className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs text-gray-400">FPV Video stream paused or disconnected</p>
                  <p className="text-[10px] text-gray-600 mt-1">MJPEG / RTSP Stream: {streamUrl}</p>
                </div>
              )}

              {/* HUD Overlay in Stream */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[9px] text-[#00e5ff] border border-[#00e5ff]/30 font-mono">
                PITCH: {pitch - 128} | ROLL: {roll - 128}
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[9px] text-[#00ff88] border border-[#00ff88]/30 font-mono">
                THR: {Math.round((throttle / 255) * 100)}%
              </div>
            </div>
          </div>

          {/* Virtual Flight Joysticks & On-Screen Touch / Mouse Pads */}
          <div className="bg-[#0e1622] rounded-xl border border-[#1b2838] p-4 shadow-xl">
            <h2 className="text-xs uppercase tracking-widest text-[#00e5ff] font-bold mb-3 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4" /> Flight Controller Pad
            </h2>

            <div className="grid grid-cols-2 gap-4">
              
              {/* Left Stick: Throttle & Yaw */}
              <div className="bg-[#090e15] p-3 rounded-xl border border-[#1b2533] flex flex-col items-center">
                <div className="text-[11px] font-bold text-gray-300 mb-2">LEFT: THROTTLE / YAW</div>
                <div className="relative w-36 h-36 rounded-full border-2 border-[#1f2d3d] bg-[#0c131c] flex items-center justify-center shadow-inner">
                  {/* Grid Lines */}
                  <div className="absolute w-full h-[1px] bg-[#1f2d3d]" />
                  <div className="absolute h-full w-[1px] bg-[#1f2d3d]" />

                  {/* Handle */}
                  <div 
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0055ff] to-[#00e5ff] border-2 border-white/60 shadow-lg shadow-[#00e5ff]/30 transition-transform duration-75 flex items-center justify-center cursor-grab active:cursor-grabbing"
                    style={{
                      transform: `translate(${((yaw - 128) / 128) * 45}px, ${((128 - throttle) / 128) * 45}px)`
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-black/60" />
                  </div>
                </div>

                <div className="flex gap-2 mt-2 text-[10px] text-gray-400">
                  <span className={`px-1.5 py-0.5 rounded border ${activeKeys.has('w') ? 'bg-[#00e5ff] text-black font-bold' : 'border-gray-700'}`}>W: ▲</span>
                  <span className={`px-1.5 py-0.5 rounded border ${activeKeys.has('s') ? 'bg-[#00e5ff] text-black font-bold' : 'border-gray-700'}`}>S: ▼</span>
                  <span className={`px-1.5 py-0.5 rounded border ${activeKeys.has('a') ? 'bg-[#00e5ff] text-black font-bold' : 'border-gray-700'}`}>A: ◀</span>
                  <span className={`px-1.5 py-0.5 rounded border ${activeKeys.has('d') ? 'bg-[#00e5ff] text-black font-bold' : 'border-gray-700'}`}>D: ▶</span>
                </div>
              </div>

              {/* Right Stick: Pitch & Roll */}
              <div className="bg-[#090e15] p-3 rounded-xl border border-[#1b2533] flex flex-col items-center">
                <div className="text-[11px] font-bold text-gray-300 mb-2">RIGHT: PITCH / ROLL</div>
                <div className="relative w-36 h-36 rounded-full border-2 border-[#1f2d3d] bg-[#0c131c] flex items-center justify-center shadow-inner">
                  {/* Grid Lines */}
                  <div className="absolute w-full h-[1px] bg-[#1f2d3d]" />
                  <div className="absolute h-full w-[1px] bg-[#1f2d3d]" />

                  {/* Handle */}
                  <div 
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00ff88] to-[#00b0ff] border-2 border-white/60 shadow-lg shadow-[#00ff88]/30 transition-transform duration-75 flex items-center justify-center cursor-grab active:cursor-grabbing"
                    style={{
                      transform: `translate(${((roll - 128) / 128) * 45}px, ${((128 - pitch) / 128) * 45}px)`
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-black/60" />
                  </div>
                </div>

                <div className="flex gap-2 mt-2 text-[10px] text-gray-400">
                  <span className={`px-1.5 py-0.5 rounded border ${(activeKeys.has('arrowup') || activeKeys.has('i')) ? 'bg-[#00ff88] text-black font-bold' : 'border-gray-700'}`}>▲ Pitch</span>
                  <span className={`px-1.5 py-0.5 rounded border ${(activeKeys.has('arrowdown') || activeKeys.has('k')) ? 'bg-[#00ff88] text-black font-bold' : 'border-gray-700'}`}>▼ Pitch</span>
                  <span className={`px-1.5 py-0.5 rounded border ${(activeKeys.has('arrowleft') || activeKeys.has('j')) ? 'bg-[#00ff88] text-black font-bold' : 'border-gray-700'}`}>◀ Roll</span>
                  <span className={`px-1.5 py-0.5 rounded border ${(activeKeys.has('arrowright') || activeKeys.has('l')) ? 'bg-[#00ff88] text-black font-bold' : 'border-gray-700'}`}>▶ Roll</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Console / Serial Terminal Logs (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-[#0e1622] rounded-xl border border-[#1b2838] p-4 shadow-xl flex-1 flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs uppercase tracking-widest text-[#00e5ff] font-bold flex items-center gap-1.5">
                <Terminal className="w-4 h-4" /> Bluetooth Serial Stream
              </h2>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#1b2838] transition cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Terminal Box */}
            <div
              ref={logContainerRef}
              className="flex-1 bg-[#070b10] border border-[#16212e] rounded-lg p-2.5 font-mono text-[11px] overflow-y-auto space-y-1 max-h-[400px]"
            >
              {logs.length === 0 ? (
                <div className="text-gray-600 text-center mt-12 text-xs">
                  Ready. Connect ESP32 to receive live telemetry...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="leading-relaxed break-all">
                    <span className="text-gray-500 mr-1.5">[{log.time}]</span>
                    {log.type === 'sent' && <span className="text-[#00e5ff]">➔ {log.text}</span>}
                    {log.type === 'received' && <span className="text-[#00ff88]">← {log.text}</span>}
                    {log.type === 'info' && <span className="text-gray-400">ℹ {log.text}</span>}
                    {log.type === 'error' && <span className="text-red-400">✖ {log.text}</span>}
                  </div>
                ))
              )}
            </div>

            {/* Custom Command Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customCmd.trim()) {
                  sendSerialCommand(customCmd.trim());
                  setCustomCmd('');
                }
              }}
              className="mt-3 flex gap-1.5"
            >
              <input
                type="text"
                value={customCmd}
                onChange={(e) => setCustomCmd(e.target.value)}
                placeholder="Send char or P,r,p,t,y,c..."
                className="flex-1 bg-[#090e15] border border-[#1b2533] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#00e5ff]"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-[#1b2838] hover:bg-[#00e5ff] hover:text-black text-white text-xs font-semibold rounded transition cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>

      </main>

      {/* ESP32 Setup & Guide Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1622] border border-[#1f2d3d] rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1f2d3d] pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#00e5ff]" /> ESP32 Drone Bridge Setup
              </h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded bg-[#1a2533]"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-300 leading-relaxed font-sans">
              <div className="bg-[#141d2a] p-3.5 rounded-lg border border-[#233347]">
                <h4 className="font-bold text-[#00e5ff] text-sm mb-1">1. How It Works</h4>
                <p>
                  The ESP32 acts as a dual bridge: It connects to the <strong>Drone&apos;s Wi-Fi hotspot</strong> (SSID: <code>WIFI-UFO-289424</code>) and sends UDP 8080/8090 flight packets. It simultaneously creates a <strong>Bluetooth Serial SPP interface</strong> named <code>ESP32_Drone</code> that your browser connects to via Web Serial.
                </p>
              </div>

              <div className="bg-[#141d2a] p-3.5 rounded-lg border border-[#233347]">
                <h4 className="font-bold text-[#00e5ff] text-sm mb-1">2. Flash ESP32 Code</h4>
                <p>
                  The complete source code is saved in <code className="text-[#00ff88]">esp32.md</code> in your workspace root.
                </p>
                <ol className="list-decimal pl-5 mt-2 space-y-1 text-gray-400">
                  <li>Open Arduino IDE and select <strong>ESP32 Dev Module</strong>.</li>
                  <li>Copy code from <code>esp32.md</code>.</li>
                  <li>Set your Drone&apos;s SSID in the code: <code>const char* DRONE_SSID = &quot;WIFI-UFO-XXXX&quot;;</code></li>
                  <li>Click <strong>Upload</strong>.</li>
                </ol>
              </div>

              <div className="bg-[#141d2a] p-3.5 rounded-lg border border-[#233347]">
                <h4 className="font-bold text-[#00e5ff] text-sm mb-1">3. Pair Bluetooth with Windows / Laptop</h4>
                <ol className="list-decimal pl-5 space-y-1 text-gray-400">
                  <li>Power on the ESP32 (LED will blink until connected to Drone Wi-Fi).</li>
                  <li>In Windows Settings &gt; Bluetooth, pair with <strong>ESP32_Drone</strong>.</li>
                  <li>Click <strong>&quot;Connect ESP32 (BT)&quot;</strong> in the top header and select the paired port.</li>
                </ol>
              </div>

              <div className="bg-[#141d2a] p-3.5 rounded-lg border border-[#233347]">
                <h4 className="font-bold text-[#00e5ff] text-sm mb-1">4. Flight Shortcuts</h4>
                <p className="font-mono text-[11px] text-gray-300">
                  • <strong>T</strong>: Takeoff | <strong>L</strong>: Land | <strong>Space / Esc</strong>: Kill Stop<br />
                  • <strong>W / S</strong>: Throttle Up / Down<br />
                  • <strong>A / D</strong>: Yaw Left / Right (Rotate)<br />
                  • <strong>Arrow Keys / I J K L</strong>: Pitch (Forward/Back) &amp; Roll (Left/Right)
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInstructions(false)}
                className="px-5 py-2 rounded-lg bg-[#00e5ff] text-black font-bold text-xs uppercase tracking-wider hover:opacity-90 transition cursor-pointer"
              >
                Got It, Fly Now!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
