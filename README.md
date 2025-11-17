# SimpleMeet - AI-Powered Interview Platform

> A modern video conferencing platform designed specifically for consulting interviews, featuring real-time AI assistance, speech transcription, and interactive mini-games.

## ✨ Features

### 🎥 Video Conferencing
- **WebRTC P2P Connection**: Direct peer-to-peer video and audio communication
- **Real-time Controls**: Mute/unmute audio, enable/disable video, end call
- **Picture-in-Picture**: Local video overlay with remote video full screen
- **Liquid Glass UI**: Premium glassmorphic design with smooth animations

### 🤖 AI-Powered Interview Assistant (Interviewer Only)
- **Deeper Agent** 🔍: Suggests follow-up questions to dig deeper into candidate answers
- **NextQuestion Agent** ❓: Recommends the next logical question to ask
- **Auto-Detection**: AI agents analyze conversation context every 5 seconds
- **Smart Cooldown**: 60-second cooldown per agent to prevent spam
- **Claude 4.5 Haiku**: Powered by Anthropic's latest AI model

### 🎤 Real-Time Transcription
- **ElevenLabs STT**: High-quality speech-to-text transcription
- **Dual Tracking**: Separate transcription for interviewer and candidate
- **Auto-Disappear**: Transcription blocks fade after 30 seconds
- **Historical Context**: Full conversation history stored for AI analysis

### 📋 Interview Guide Checklist
- **Structured Questions**: Organized by category (Fit & Motivation, Behavioral, Analytical)
- **Progress Tracking**: Check off questions as you ask them
- **Key Questions Highlighted**: Special section for "Questions worth asking"
- **Real-time Updates**: Questions automatically checked when detected in conversation

### 🎮 Interactive Mini-Games
- **Tic Tac Toe**: Built-in game synchronized between both participants
- **Liquid Glass Design**: Beautiful animated popup with glassmorphic effects
- **Real-time Sync**: Game state synchronized via Supabase
- **Interviewer Controls**: Only interviewer can close the game for both participants

## 🎨 Design Features

- **Glassmorphism**: Modern liquid glass aesthetic throughout the interface
- **Gradient Backgrounds**: Dynamic animated gradients on homepage
- **Smooth Animations**: Staggered fade-in and slide-in effects
- **Responsive Design**: Optimized for desktop viewing
- **Color-Coded Elements**: Blue for interviewer, purple/yellow for candidate
- **Dark/Light Contrast**: Dark video area with light sidebar for optimal visibility

## 🚀 Getting Started

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- ElevenLabs API key
- Anthropic (Claude) API key
- Supabase project

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd loophr-main

# Install dependencies
npm install

# Copy the sample environment file and fill in your secrets
cp env.example .env
# then edit .env to add your real keys

# Start development server
npm run dev
```

### Environment Variables

The repository ships with an `env.example` file. Duplicate it (`cp env.example .env`) and fill in the values:

- `VITE_SUPABASE_URL` – your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – the public anon/publishable key
- `VITE_ELEVENLABS_API_KEY` – used for speech-to-text and scribe tokens
- `VITE_ANTHROPIC_API_KEY` – Claude 3.5 Haiku access
- Optional tuning knobs: `VITE_VOLUME_THRESHOLD`, `VITE_SILENCE_THRESHOLD`, `VITE_MIN_RECORDING_DURATION`

Never commit the filled `.env` file—it's ignored by Git by default.

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom glassmorphic utilities
- **Video**: WebRTC (RTCPeerConnection)
- **Signaling**: Supabase Realtime
- **AI**: Anthropic Claude 3.5 Haiku
- **Transcription**: ElevenLabs Speech-to-Text
- **UI Components**: shadcn/ui
- **Routing**: React Router

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── NavLink.tsx      # Navigation component
│   └── TicTacToeGame.tsx # Mini-game component
├── pages/
│   ├── Index.tsx        # Homepage (role selection)
│   ├── Meeting.tsx      # Main meeting interface
│   └── NotFound.tsx     # 404 page
├── utils/
│   ├── webrtc.ts        # WebRTC connection logic
│   ├── transcription.ts # ElevenLabs integration
│   ├── claude.ts        # Question detection
│   └── agents.ts        # AI agents orchestrator
├── integrations/
│   └── supabase/        # Supabase client & types
└── hooks/               # Custom React hooks
```

## 🎯 Usage

### For Interviewers
1. Select "Interviewer" role on homepage
2. Wait for candidate to join
3. Use the sidebar to:
   - Track interview questions
   - View AI agent suggestions
   - Launch mini-games
4. Monitor real-time transcriptions
5. Let AI agents assist with follow-up questions

### For Candidates
1. Select "Candidate" role on homepage
2. Join the meeting
3. Participate in mini-games when launched
4. Answer interview questions naturally

## 🔐 Security & Privacy

- **Secrets hygiene**: `.env` is ignored, and `env.example` documents every required variable
- **P2P Connection**: Video/audio data transmitted directly between peers
- **No Recording**: No persistent storage of video/audio streams
- **Temporary Transcriptions**: Transcripts stored in memory, cleared after 30s display
- **Secure API Keys**: All API keys stored as environment variables

## 🤝 Contributing

This project was built for a hackathon. Feel free to fork and adapt for your own needs!

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- **Anthropic**: Claude AI for intelligent interview assistance
- **ElevenLabs**: High-quality speech-to-text transcription
- **Supabase**: Real-time database and signaling
- **shadcn/ui**: Beautiful UI components
- **Tailwind CSS**: Utility-first CSS framework

## ✅ Security Checklist Before Publishing

- [ ] Have you duplicated `env.example` to `.env` locally instead of committing secrets?
- [ ] Did you verify that no API keys or tokens are hard-coded in code or docs?
- [ ] Are you using separate Supabase projects/keys for staging vs. production?
- [ ] Have you reviewed `supabase/config.toml` to ensure it only contains non-sensitive metadata (project IDs are fine)?
- [ ] Did you validate that CI/CD logs or deployment previews do not expose runtime environment variables?

---

Built with ❤️ for better interviews
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/7f848c87-1933-4e42-99c5-5e4878cf1546) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
