import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, UserCircle, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const joinAsMember = (role: "interviewer" | "interviewee") => {
    navigate(`/meeting?role=${role}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="max-w-2xl w-full space-y-8 relative z-10">
        {/* Logo/Title */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top duration-700">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(59,130,246,0.3)] mb-4">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            Simple<span className="text-blue-400">Meet</span>
          </h1>
          <p className="text-lg text-white/80 drop-shadow-lg">
            Choose your role to join the meeting
          </p>
        </div>

        {/* Role Selection */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Interviewer Card */}
          <button
            onClick={() => joinAsMember("interviewer")}
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 text-left transition-all duration-300 hover:bg-white/15 hover:shadow-[0_8px_32px_0_rgba(59,130,246,0.4)] hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50 animate-in fade-in slide-in-from-left duration-700 delay-100"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 backdrop-blur-xl border border-blue-400/30 group-hover:bg-blue-500/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300">
                <Users className="w-8 h-8 text-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2 drop-shadow-lg">
                  Interviewer
                </h2>
                <p className="text-white/70">
                  Join as the recruiter or person conducting the interview
                </p>
              </div>
            </div>
          </button>

          {/* Interviewee Card */}
          <button
            onClick={() => joinAsMember("interviewee")}
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 text-left transition-all duration-300 hover:bg-white/15 hover:shadow-[0_8px_32px_0_rgba(168,85,247,0.4)] hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50 animate-in fade-in slide-in-from-right duration-700 delay-100"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 backdrop-blur-xl border border-purple-400/30 group-hover:bg-purple-500/30 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300">
                <UserCircle className="w-8 h-8 text-purple-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2 drop-shadow-lg">
                  Candidate
                </h2>
                <p className="text-white/70">
                  Join as the candidate or interview participant
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Info */}
        <div className="text-center animate-in fade-in slide-in-from-bottom duration-700 delay-200">
          <p className="text-sm text-white/60">
            Both roles join the same meeting. No account needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
