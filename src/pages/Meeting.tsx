import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Search, HelpCircle } from "lucide-react";
import { WebRTCConnection } from "@/utils/webrtc";
import { useToast } from "@/hooks/use-toast";
import { AudioTranscriptionService, TranscriptionBlock } from "@/utils/transcription";
import { sendToClaude } from "@/utils/claude";
import { getAgentSuggestions, AgentMessage } from "@/utils/agents";
import TicTacToeGame, { GameState } from "@/components/TicTacToeGame";
import { supabase } from "@/integrations/supabase/client";

const Meeting = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") as "interviewer" | "interviewee";
  const { toast } = useToast();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionBlock[]>([]);
  
  // State for interview questions checklist (interviewer only)
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());
  
  // State for AI agent messages (interviewer only)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  
  // State for Tic Tac Toe game
  const [isTicTacToeOpen, setIsTicTacToeOpen] = useState(false);
  const [ticTacToeGameState, setTicTacToeGameState] = useState<GameState | undefined>(undefined);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const webrtcRef = useRef<WebRTCConnection | null>(null);
  const localTranscriptionRef = useRef<AudioTranscriptionService | null>(null);
  const remoteTranscriptionRef = useRef<AudioTranscriptionService | null>(null);
  const remoteTranscriptionStarted = useRef<boolean>(false); // Protection against double start
  const checklistIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const agentsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Accumulated transcript for Claude analysis (interviewer messages only)
  const accumulatedTranscriptRef = useRef<string>("");
  
  // Full history of all transcriptions for agents (never cleared)
  const transcriptionHistoryRef = useRef<TranscriptionBlock[]>([]);
  
  // Session ID for agents
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);
  
  // Cooldown tracking for agents (60 seconds per agent)
  const agentCooldownRef = useRef<{ Deeper: number | null; NextQuestion: number | null }>({
    Deeper: null,
    NextQuestion: null
  });

  useEffect(() => {
    const senderId = `${role}-${Math.random().toString(36).substr(2, 9)}`;
    startConnection(senderId);
    
    // Start checklist timer if interviewer
    if (role === "interviewer") {
      startChecklistTimer();
      startAgentsTimer();
    }
    
    return () => {
      cleanup();
      // Clean up timers
      if (checklistIntervalRef.current) {
        clearInterval(checklistIntervalRef.current);
      }
      if (agentsIntervalRef.current) {
        clearInterval(agentsIntervalRef.current);
      }
    };
  }, []);

  const startConnection = async (senderId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      localStreamRef.current = stream;

      // Start local stream transcription ONLY if interviewer
      if (role === "interviewer") {
        console.log("[Meeting] Starting local transcription (interviewer only)");
        startLocalTranscription(stream);
      } else {
        console.log("[Meeting] Skipping local transcription (not interviewer)");
      }

      // Initialize WebRTC connection
      webrtcRef.current = new WebRTCConnection(
        senderId,
        (remoteStream) => {
          console.log("Setting remote stream");
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteStreamRef.current = remoteStream;
            setIsConnected(true);
            
            // Start remote stream transcription ONLY if interviewer
            // AND only if not already started (protection against double ontrack call)
            if (role === "interviewer" && !remoteTranscriptionStarted.current) {
              console.log("[Meeting] Starting remote transcription (interviewer only)");
              remoteTranscriptionStarted.current = true;
              startRemoteTranscription(remoteStream);
            } else if (role === "interviewer" && remoteTranscriptionStarted.current) {
              console.log("[Meeting] Remote transcription already started, skipping...");
            } else {
              console.log("[Meeting] Skipping remote transcription (not interviewer)");
            }
            
            toast({
              title: "Participant connected",
              description: "You are now connected with the other participant",
            });
          }
        }
      );

      await webrtcRef.current.initialize(stream);
      
      toast({
        title: "Waiting",
        description: "Waiting for another participant...",
      });
    } catch (error) {
      console.error("Media access error:", error);
      toast({
        title: "Error",
        description: "Unable to access camera or microphone",
        variant: "destructive",
      });
    }
  };

    const handleTranscription = (block: TranscriptionBlock) => {
    console.log(`[${block.speaker}] Transcription received:`, { text: block.text });
    
    // Remove content in parentheses (music, laughter, etc.)
    let cleanedText = block.text.replace(/\([^)]*\)/g, '').trim();
    
    // If after cleaning the text is empty or only parentheses content, ignore it
    if (!cleanedText || cleanedText.length === 0) {
      console.log(`[${block.speaker}] Transcription ignored (only parentheses content):`, block.text);
      return;
    }
    
    // Update block with cleaned text
    const cleanedBlock = {
      ...block,
      text: cleanedText
    };
    
    // Accumulate interviewer messages for Claude analysis
    if (block.speaker === "interviewer") {
      accumulatedTranscriptRef.current += " " + cleanedText;
      console.log(`💾 Accumulated transcript updated (length: ${accumulatedTranscriptRef.current.length})`);
    }

    // Add to full history for agents (never cleared)
    transcriptionHistoryRef.current = [...transcriptionHistoryRef.current, cleanedBlock];
    console.log(`📚 Transcription history updated (total: ${transcriptionHistoryRef.current.length})`);

    setTranscriptions((prev) => {
      const newTranscriptions = [...prev, cleanedBlock];
      // Limit to 5 blocks maximum
      if (newTranscriptions.length > 5) {
        return newTranscriptions.slice(-5); // Keep only last 5
      }
      return newTranscriptions;
    });

    // Make block disappear after 30 seconds
    setTimeout(() => {
      setTranscriptions((prev) => prev.filter((b) => b.timestamp !== cleanedBlock.timestamp));
    }, 30000);
  };

  /**
   * Get the complete recruiter (interviewer) transcript
   * Uses accumulated transcript from ref for immediate access
   */
  const getRecruiterTranscript = async (): Promise<string> => {
    const transcript = accumulatedTranscriptRef.current.trim();
    console.log("📝 Recruiter transcript:", transcript.substring(0, 100) + (transcript.length > 100 ? "..." : ""));
    return transcript;
  };

  /**
   * Update the detected questions checklist
   * Replaces current state with newly detected IDs
   */
  const updateChecklist = (idsToCheck: string[]) => {
    console.log("✓ Updating checklist with:", idsToCheck);
    setCheckedQuestions(new Set(idsToCheck));
  };

  /**
   * Start the timer that analyzes transcript every 3 seconds
   * Only active for interviewer
   */
  const startChecklistTimer = () => {
    console.log("⏰ Starting checklist timer (every 3 seconds)");
    
    checklistIntervalRef.current = setInterval(async () => {
      try {
        // Get recruiter transcript
        const transcript = await getRecruiterTranscript();
        
        // Skip if no transcript
        if (!transcript || transcript.trim().length === 0) {
          return;
        }
        
        // Send to Claude to detect questions
        const idsToCheck = await sendToClaude(transcript);
        
        // Update checklist
        updateChecklist(idsToCheck);
      } catch (error) {
        console.error("❌ Error in checklist timer:", error);
      }
    }, 3000); // Every 3 seconds
  };

  /**
   * Start the timer that calls AI agents every 5 seconds
   * Only active for interviewer
   */
  const startAgentsTimer = () => {
    console.log("🤖 Starting agents timer (every 5 seconds)");
    
    agentsIntervalRef.current = setInterval(async () => {
      try {
        const historyLength = transcriptionHistoryRef.current.length;
        console.log("🤖 Agent timer tick - history count:", historyLength, "visible transcriptions:", transcriptions.length);
        
        // Only call agents if we have some transcription history
        if (historyLength === 0) {
          console.log("🤖 No transcription history yet, skipping agent call");
          return;
        }
        
        // Get last candidate message from full history (or last message if testing alone)
        const lastCandidateMessage = [...transcriptionHistoryRef.current]
          .reverse()
          .find(t => t.speaker === "interviewee");
        
        // Fallback: use last message if no candidate message (for testing)
        const lastMessage = lastCandidateMessage || transcriptionHistoryRef.current[transcriptionHistoryRef.current.length - 1];
        
        if (!lastMessage) {
          console.log("🤖 No messages found, skipping agent call");
          return;
        }
        
        console.log("🤖 Last message:", lastMessage.text.substring(0, 50), "from:", lastMessage.speaker);
        
        // Use last 10 messages from history for context
        const recentHistory = transcriptionHistoryRef.current.slice(-10);
        
        // Prepare agent input
        const agentInput = {
          session_id: sessionIdRef.current,
          speaker: "candidate" as const,
          last_text: lastMessage.text,
          history: recentHistory.map(t => ({
            speaker: t.speaker === "interviewer" ? "interviewer" : "candidate",
            text: t.text,
            timestamp: t.timestamp
          })),
          job_profile: "Consultant role - Strategy, analytical skills, client management, teamwork",
          questions_already_asked: Array.from(checkedQuestions)
        };
        
        console.log("🤖 Calling agents with input:", {
          session_id: agentInput.session_id,
          last_text: agentInput.last_text.substring(0, 50),
          history_count: agentInput.history.length,
          questions_count: agentInput.questions_already_asked.length
        });
        
        // Call agents
        const response = await getAgentSuggestions(agentInput);
        
        console.log("🤖 Agent response:", response);
        
        // Update agent messages (replace old ones) with cooldown check
        if (response.messages.length > 0) {
          const now = Date.now();
          const agentName = response.messages[0].agent;
          const lastShown = agentCooldownRef.current[agentName];
          
          // Check if 60 seconds have passed since last message from this agent
          if (!lastShown || (now - lastShown) >= 60000) {
            console.log(`🤖 Setting agent message from ${agentName}:`, response.messages);
            setAgentMessages(response.messages);
            
            // Update cooldown timestamp
            agentCooldownRef.current[agentName] = now;
            
            // Auto-dismiss after 10 seconds
            setTimeout(() => {
              setAgentMessages([]);
            }, 10000);
          } else {
            const remainingCooldown = Math.ceil((60000 - (now - lastShown)) / 1000);
            console.log(`🤖 Agent ${agentName} on cooldown for ${remainingCooldown}s more`);
          }
        } else {
          console.log("🤖 No agent messages to display");
        }
        
      } catch (error) {
        console.error("❌ Error in agents timer:", error);
      }
    }, 5000); // Every 5 seconds
  };

  const startLocalTranscription = async (stream: MediaStream) => {
    try {
      // Create new stream with only audio
      const audioStream = new MediaStream(stream.getAudioTracks());
      
      localTranscriptionRef.current = new AudioTranscriptionService(
        role, // "interviewer" or "interviewee"
        handleTranscription
      );
      
      await localTranscriptionRef.current.startTranscription(audioStream);
      console.log("Local transcription started");
    } catch (error) {
      console.error("Error starting local transcription:", error);
      toast({
        title: "Transcription error",
        description: "Unable to start local transcription",
        variant: "destructive",
      });
    }
  };

  const startRemoteTranscription = async (stream: MediaStream) => {
    try {
      // Create new stream with only audio
      const audioStream = new MediaStream(stream.getAudioTracks());
      
      const remoteSpeaker = role === "interviewer" ? "interviewee" : "interviewer";
      
      remoteTranscriptionRef.current = new AudioTranscriptionService(
        remoteSpeaker,
        handleTranscription
      );
      
      await remoteTranscriptionRef.current.startTranscription(audioStream);
      console.log("Remote transcription started");
    } catch (error) {
      console.error("Error starting remote transcription:", error);
      toast({
        title: "Transcription error",
        description: "Unable to start remote transcription",
        variant: "destructive",
      });
    }
  };

  const cleanup = () => {
    // Stop transcriptions
    if (localTranscriptionRef.current) {
      localTranscriptionRef.current.stop();
    }
    if (remoteTranscriptionRef.current) {
      remoteTranscriptionRef.current.stop();
    }
    
    // Reset flag
    remoteTranscriptionStarted.current = false;
    
    // Reset accumulated transcript
    accumulatedTranscriptRef.current = "";
    
    if (webrtcRef.current) {
      webrtcRef.current.disconnect();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    cleanup();
    navigate("/");
  };

  // Tic Tac Toe game management
  const handleOpenTicTacToe = () => {
    setIsTicTacToeOpen(true);
    // Send open signal to other participant
    sendGameMessage('open-game', null);
  };

  const handleCloseTicTacToe = () => {
    setIsTicTacToeOpen(false);
    setTicTacToeGameState(undefined);
    // Send close signal to other participant
    sendGameMessage('close-game', null);
  };

  const handleGameStateChange = (newGameState: GameState) => {
    setTicTacToeGameState(newGameState);
    // Send game state to other participant
    sendGameMessage('game-state', newGameState);
  };

  const sendGameMessage = async (type: string, gameState: GameState | null) => {
    try {
      const { error } = await supabase.from("signaling_messages").insert({
        room_id: "main-room",
        sender_id: role === "interviewer" ? "interviewer" : "candidate",
        message_type: type,
        payload: gameState ? JSON.parse(JSON.stringify(gameState)) : {},
      });
      if (error) console.error("Error sending game message:", error);
    } catch (error) {
      console.error("Error sending game message:", error);
    }
  };

  // Listen for game messages from the other participant
  useEffect(() => {
    const channel = supabase
      .channel("game-sync")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signaling_messages",
          filter: `room_id=eq.main-room`,
        },
        (payload: any) => {
          const message = payload.new;
          const senderId = message.sender_id;
          const myId = role === "interviewer" ? "interviewer" : "candidate";
          
          // Ignore own messages
          if (senderId === myId) return;

          if (message.message_type === 'open-game') {
            setIsTicTacToeOpen(true);
          } else if (message.message_type === 'close-game') {
            setIsTicTacToeOpen(false);
            setTicTacToeGameState(undefined);
          } else if (message.message_type === 'game-state') {
            const gameState = message.payload as GameState;
            if (gameState) {
              setTicTacToeGameState(gameState);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main layout: Video (left) + Sidebar (right) if interviewer */}
      {/* Left column: Video Grid (always present) */}
      <main className="flex-1 relative">
        {/* Remote Video - Full Screen */}
        <div className="absolute inset-0 bg-video-background">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-video-background">
              <div className="text-muted-foreground text-center">
                <Video className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>Waiting for participant...</p>
              </div>
            </div>
          )}
          {isConnected && (
            <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl border border-white/20 px-3 py-1 rounded-lg shadow-lg">
              <span className="text-sm text-white drop-shadow-lg">
                {role === "interviewer" ? "Candidate" : "Interviewer"}
              </span>
            </div>
          )}
        </div>

        {/* Local Video - Picture in Picture (Top Left) */}
        <div className="absolute top-4 left-4 w-64 aspect-video bg-black/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/20 z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-xl">
              <VideoOff className="w-8 h-8 text-white/50" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-white/10 backdrop-blur-xl border border-white/20 px-2 py-1 rounded-lg">
            <span className="text-xs text-white">You</span>
          </div>
        </div>

        {/* Transcription Blocks - Bottom Left (stacked, auto-disappear) */}
        {role === "interviewer" && (
          <div className="absolute bottom-24 left-4 w-96 pointer-events-none z-10">
            <div className="flex flex-col-reverse gap-2">
              {transcriptions.map((block, index) => (
                <div
                  key={`${block.timestamp}-${index}`}
                  className={`
                    bg-white/10 backdrop-blur-xl rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border
                    animate-in slide-in-from-bottom-5 fade-in duration-500
                    ${block.speaker === "interviewer" ? "border-l-4 border-blue-400" : "border-l-4 border-yellow-400"}
                    ${block.speaker === "interviewer" ? "border-white/20" : "border-white/20"}
                  `}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-semibold text-white drop-shadow-lg">
                      {block.speaker === "interviewer" ? "Interviewer" : "Candidate"}
                    </span>
                    <span className="text-xs text-white/70">
                      {new Date(block.timestamp).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white drop-shadow-lg">{block.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Agents - Below Remote Video (interviewer only) */}
        {role === "interviewer" && (
          <div className="absolute top-4 right-4 flex flex-col gap-4 z-10">
            {/* Deeper Agent */}
            <div className="relative group z-20">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(59,130,246,0.3)] flex items-center justify-center cursor-pointer hover:bg-blue-500/20 hover:shadow-[0_8px_32px_0_rgba(59,130,246,0.5)] transition-all duration-300">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                  Deeper
                </div>
              </div>
              {/* Agent message bubble - appears above */}
              {agentMessages.find(m => m.agent === "Deeper") && (
                <div className="absolute top-1/2 -translate-y-1/2 right-14 animate-in slide-in-from-right-5 fade-in duration-300 whitespace-nowrap">
                  <div className="bg-blue-500/10 backdrop-blur-xl border border-blue-400/30 text-white text-sm px-4 py-2 rounded-2xl shadow-[0_8px_32px_0_rgba(59,130,246,0.3)] w-max line-clamp-2 h-[52px] flex items-center">
                    <span className="max-w-[800px] line-clamp-2">
                      {agentMessages.find(m => m.agent === "Deeper")?.text}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* NextQuestion Agent */}
            <div className="relative group z-10">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(168,85,247,0.3)] flex items-center justify-center cursor-pointer hover:bg-purple-500/20 hover:shadow-[0_8px_32px_0_rgba(168,85,247,0.5)] transition-all duration-300">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                  NextQuestion
                </div>
              </div>
              {/* Agent message bubble - appears above */}
              {agentMessages.find(m => m.agent === "NextQuestion") && (
                <div className="absolute top-1/2 -translate-y-1/2 right-14 animate-in slide-in-from-right-5 fade-in duration-300 whitespace-nowrap">
                  <div className="bg-purple-500/10 backdrop-blur-xl border border-purple-400/30 text-white text-sm px-4 py-2 rounded-2xl shadow-[0_8px_32px_0_rgba(168,85,247,0.3)] w-max line-clamp-2 h-[52px] flex items-center">
                    <span className="max-w-[800px] line-clamp-2">
                      {agentMessages.find(m => m.agent === "NextQuestion")?.text}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Controls - Overlay on video */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={toggleMute}
              className="rounded-full w-14 h-14 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              size="lg"
              variant={isVideoOff ? "destructive" : "secondary"}
              onClick={toggleVideo}
              className="rounded-full w-14 h-14 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>

            <Button
              size="lg"
              variant="destructive"
              onClick={endCall}
              className="rounded-full w-14 h-14 shadow-[0_8px_32px_0_rgba(239,68,68,0.4)] backdrop-blur-xl bg-red-500/20 border border-red-400/30 hover:bg-red-500/30 transition-all duration-300"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>
        </main>

        {/* Right column: Checklist Sidebar (interviewer only) */}
        {role === "interviewer" && (
          <aside className="w-80 bg-white/95 backdrop-blur-2xl border-l border-white/40 overflow-y-auto shadow-[0_0_50px_0_rgba(0,0,0,0.15)]">
            <div className="p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3 drop-shadow-sm">
                 Interview Guide
              </h2>
              
              {/* Fit & Motivation */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 tracking-wider">
                  Fit & Motivation
                </h3>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="fit-why-consulting"
                      checked={checkedQuestions.has("fit-why-consulting")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("fit-why-consulting");
                        } else {
                          newSet.delete("fit-why-consulting");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      Why consulting?
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="fit-why-firm"
                      checked={checkedQuestions.has("fit-why-firm")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("fit-why-firm");
                        } else {
                          newSet.delete("fit-why-firm");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      Why our firm specifically?
                    </span>
                  </label>
                </div>
              </div>

              {/* Behavioral Questions */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 tracking-wider">
                  Behavioral Questions
                </h3>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="behav-challenging-project"
                      checked={checkedQuestions.has("behav-challenging-project")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("behav-challenging-project");
                        } else {
                          newSet.delete("behav-challenging-project");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      Tell me about a challenging project
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="behav-led-team"
                      checked={checkedQuestions.has("behav-led-team")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("behav-led-team");
                        } else {
                          newSet.delete("behav-led-team");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      Describe a time you led a team
                    </span>
                  </label>
                </div>
              </div>

              {/* Analytical & Technical Skills */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 tracking-wider">
                  Analytical & Technical Skills
                </h3>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="analytical-analyze-data"
                      checked={checkedQuestions.has("analytical-analyze-data")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("analytical-analyze-data");
                        } else {
                          newSet.delete("analytical-analyze-data");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      How would you analyze this data?
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="analytical-metrics"
                      checked={checkedQuestions.has("analytical-metrics")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("analytical-metrics");
                        } else {
                          newSet.delete("analytical-metrics");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      What metrics would you use?
                    </span>
                  </label>
                </div>
              </div>

              {/* Questions worth asking */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-red-600 uppercase mb-2 tracking-wider">
                  Questions worth asking
                </h3>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="worth-counterintuitive-insight"
                      checked={checkedQuestions.has("worth-counterintuitive-insight")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("worth-counterintuitive-insight");
                        } else {
                          newSet.delete("worth-counterintuitive-insight");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      What's the most counterintuitive insight you've learned in consulting?
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      id="worth-redesign-process"
                      checked={checkedQuestions.has("worth-redesign-process")}
                      onChange={(e) => {
                        const newSet = new Set(checkedQuestions);
                        if (e.target.checked) {
                          newSet.add("worth-redesign-process");
                        } else {
                          newSet.delete("worth-redesign-process");
                        }
                        setCheckedQuestions(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700 flex-1">
                      If you could redesign our client engagement process from scratch, what would you change?
                    </span>
                  </label>
                </div>
              </div>

              {/* Exercise Type Buttons */}
              <div className="mt-auto pt-6 border-t border-gray-200">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3 tracking-wider">
                  Exercises
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button className="aspect-square p-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] text-blue-700 text-base font-semibold rounded-xl transition-all duration-300 flex items-center justify-center">
                    Case
                  </button>
                  <button className="aspect-square p-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] text-blue-700 text-base font-semibold rounded-xl transition-all duration-300 flex items-center justify-center">
                    Brain Teaser
                  </button>
                  <button 
                    onClick={handleOpenTicTacToe}
                    className="aspect-square p-3 bg-purple-50 border border-purple-200 hover:bg-purple-100 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] text-purple-700 text-base font-semibold rounded-xl transition-all duration-300 flex items-center justify-center"
                  >
                    Mini-games
                  </button>
                  <button className="aspect-square p-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] text-blue-700 text-base font-semibold rounded-xl transition-all duration-300 flex items-center justify-center">
                    Coding
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Tic Tac Toe Game Popup */}
        <TicTacToeGame
          isOpen={isTicTacToeOpen}
          onClose={handleCloseTicTacToe}
          role={role}
          onGameStateChange={handleGameStateChange}
          externalGameState={ticTacToeGameState}
        />
    </div>
  );
};

export default Meeting;
