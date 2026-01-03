Overview

This repository contains a real-time video interviewing platform built during a hackathon, designed to explore the behavior and limitations of LLM-based assistants in live, interactive settings.
The system integrates video conferencing, real-time speech transcription, and multiple LLM-driven agents that suggest follow-up interview questions based on ongoing conversation context.
Beyond the product itself, this project primarily served as a practical exploration of LLM reliability, relevance, and failure modes when deployed in dynamic, low-latency environments.

Motivation & Scope

LLMs are increasingly proposed as “assistants” for high-stakes human interactions (interviews, meetings, coaching).
This project investigates a concrete instantiation of that idea:
Can LLM-based agents meaningfully assist an interviewer in real time, without degrading interaction quality or introducing misleading suggestions?
The goal was not to build a perfect AI interviewer, but to:
observe how LLMs behave under tight time constraints, test whether contextual understanding holds over long conversations, identify practical failure modes beyond offline benchmarks.

Key Observations & Lessons Learned

Through development and testing, several limitations became apparent:
Surface-level relevance : 
Agent-generated follow-up questions are often plausible but shallow, especially as conversations grow longer.
Context degradation : 
Despite access to recent transcripts, suggestions lose coherence over time, leading to repetition or irrelevant probing.
Latency vs reasoning trade-off : 
Short inference budgets favor fluency over depth, making deeper analytical questioning unreliable in real time.
Overconfidence and hallucination risk : 
The system occasionally suggests questions based on incorrect or weakly inferred assumptions from prior answers.

Evaluation is hard : 
Measuring “good” interview assistance is inherently subjective, making systematic evaluation challenging.

These observations made me increasingly skeptical of claims around “AI interviewers” and motivated further interest in evaluation, reasoning robustness, and agent stability.

System Description : 

The platform combines:
Peer-to-peer video conferencing using WebRTC
Real-time speech-to-text transcription for both participants
LLM-based agents that periodically analyze conversational context and suggest follow-up questions
A structured interview guide to anchor human decision-making
Optional interactive elements (mini-games) to explore synchronization and shared state
The AI components are intentionally constrained and cooldown-limited to reduce noise and over-intervention.

AI Agents (Design Intent) : 
Two simple agents were implemented:
Follow-up agent: suggests deeper questions based on recent answers
Next-question agent: proposes a logical continuation within an interview structure
Both agents operate on:
short rolling context windows, periodic triggers rather than continuous streaming, explicit cooldowns to limit overuse.
This design reflects an assumption that human judgment must remain central, with AI acting only as a weak signal.

Tech Stack
Frontend: React 18, TypeScript, Vite
Video: WebRTC (P2P via RTCPeerConnection)
Realtime signaling & state: Supabase Realtime
LLMs: Anthropic Claude (Haiku tier)
Speech-to-text: ElevenLabs
Styling: Tailwind CSS, shadcn/ui



Limitations :

This project leaves several questions open:
How can we evaluate LLM assistance quality without leaking ground truth?
Can reasoning depth be improved without increasing latency?
Should planning and question generation be decoupled?
How do we prevent conversational drift over long horizons?
Are such assistants fundamentally better suited as offline tools?
These questions are more interesting than the product itself.

Project Context: 

This project was developed during a hackathon and is not intended as a production-ready system.
The code prioritizes clarity and experimentation over completeness or optimization.

Getting Started (Optional)

(You can keep this section largely as-is; it’s secondary.)

[installation steps, env variables, etc.]

Final Note

This repository reflects a hands-on exploration of LLM-based systems, not a claim of solved problems.
Most value came from observing what does not work reliably — especially under real-time constraints.


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


