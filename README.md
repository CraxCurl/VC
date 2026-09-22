# 📹 Meet Duo - Private 1-on-1 Video Calling & Live Chat (Google Meet Style)

A high-performance, Google Meet-inspired private 1-on-1 video calling and instant messaging web app built with Next.js (App Router, Tailwind CSS, TypeScript, and WebRTC). Optimized for **ultra-low internet / data consumption** and designed to deploy effortlessly to **Vercel**.

---

## ✨ Features

- **Google Meet Aesthetics**: Modern dark theme (`#131314`), glassmorphism floating control bar, active speaker glowing border, and layout controls (Split View & Picture-in-Picture).
- **Direct Peer-to-Peer (P2P)**: Uses WebRTC direct data & media channels. No media server in the middle — zero streaming latency and zero server bandwidth costs on Vercel.
- **Ultra-Low Data Saver Engine**:
  - **Data Saver (Eco)**: 360p @ 15fps (~180-250 kbps) — lowest possible mobile network usage.
  - **Balanced**: 480p @ 24fps (~500 kbps).
  - **High Definition**: 720p @ 30fps (~1.2 Mbps).
  - **Audio Only**: Pauses video track send to consume minimal voice data (~24 kbps).
  - WebRTC dynamic bitrate throttle (`RTCRtpSender` encoding parameters).
- **Live In-Call Text Chat**: Real-time messaging directly via WebRTC Data Channels with unread badges, timestamping, and emojis.
- **Screen Sharing**: 1-click screen/tab/window sharing with dynamic track replacement.
- **Floating Reactions**: Animated synced emojis (❤️, 👍, 😂, 🎉, 🔥, 👏).
- **Live Audio Waveform**: Speaking detector and volume level meter in lobby and room.
- **Synthetic Sound Effects**: Zero external mp3 dependencies (built using Web Audio API for join, leave, mute, and message chimes).

---

## 🚀 How to Run Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.
   - Click **Start instant 1-on-1 call**.
   - Copy the invite link and open it in an Incognito tab or second browser to test the 2-way call and live chat!

---

## ☁️ How to Deploy on Vercel (100% Free)

Because all video, audio, and chat messaging is handled directly peer-to-peer via WebRTC and client-side PeerJS STUN servers, this app is **100% serverless-ready** with no WebSocket server required!

### Option 1: Via Vercel CLI
```bash
npx vercel
```

### Option 2: Via GitHub & Vercel Dashboard
1. Push this repository to your GitHub:
   ```bash
   git add .
   git commit -m "Meet Duo initial release"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Click **Deploy**!
5. Share your generated Vercel URL (e.g., `https://your-app.vercel.app`) with your friend to start calling!

---

## ⌨️ In-Call Keyboard Shortcuts

- `M` or `Ctrl + D`: Toggle Microphone (Mute / Unmute)
- `V` or `Ctrl + E`: Toggle Camera (Video On / Off)
- `C`: Open / Close Live Chat Drawer
