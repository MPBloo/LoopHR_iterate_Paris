import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, UserCircle, Users } from "lucide-react";
import type { TranscriptionBlock } from "@/utils/transcription";

interface TranscriptionPanelProps {
  segments?: TranscriptionBlock[];
  partialInterviewer?: string;
  partialInterviewee?: string;
}

export const TranscriptionPanel = ({
  segments = [],
  partialInterviewer = "",
  partialInterviewee = "",
}: TranscriptionPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand de nouveaux segments arrivent
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, partialInterviewer, partialInterviewee]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="h-full bg-white border-border shadow-lg">
      <div className="p-4 border-b border-border bg-white">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Transcription en direct</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Les transcriptions s'affichent après 3 secondes de silence
        </p>
      </div>

      <ScrollArea className="h-[calc(100%-80px)]">
        <div ref={scrollRef} className="p-4 space-y-4">
          {/* Segments terminés */}
          {segments.map((segment, index) => (
            <div
              key={`${segment.speaker}-${segment.timestamp}-${index}`}
              className={`flex gap-3 ${
                segment.speaker === "interviewer"
                  ? "justify-start"
                  : "justify-end"
              }`}
            >
              <div
                className={`flex flex-col max-w-[80%] ${
                  segment.speaker === "interviewee" ? "items-end" : "items-start"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {segment.speaker === "interviewer" ? (
                    <>
                      <Users className="w-4 h-4 text-primary" />
                      <Badge variant="outline" className="text-xs">
                        Interviewer
                      </Badge>
                    </>
                  ) : (
                    <>
                      <UserCircle className="w-4 h-4 text-secondary" />
                      <Badge variant="secondary" className="text-xs">
                        Interviewé
                      </Badge>
                    </>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatTime(segment.timestamp)}
                  </span>
                </div>

                <div
                  className={`rounded-lg p-3 ${
                    segment.speaker === "interviewer"
                      ? "bg-primary/10 text-gray-900"
                      : "bg-secondary/10 text-gray-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{segment.text}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Transcription partielle de l'interviewer */}
          {partialInterviewer && (
            <div className="flex gap-3 justify-start">
              <div className="flex flex-col max-w-[80%] items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary animate-pulse" />
                  <Badge variant="outline" className="text-xs">
                    Interviewer
                  </Badge>
                  <span className="text-xs text-gray-500 italic">
                    en cours...
                  </span>
                </div>

                <div className="rounded-lg p-3 bg-primary/5 text-gray-900 border border-primary/20">
                  <p className="text-sm whitespace-pre-wrap italic opacity-70">
                    {partialInterviewer}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transcription partielle de l'interviewé */}
          {partialInterviewee && (
            <div className="flex gap-3 justify-end">
              <div className="flex flex-col max-w-[80%] items-end">
                <div className="flex items-center gap-2 mb-1">
                  <UserCircle className="w-4 h-4 text-secondary animate-pulse" />
                  <Badge variant="secondary" className="text-xs">
                    Interviewé
                  </Badge>
                  <span className="text-xs text-gray-500 italic">
                    en cours...
                  </span>
                </div>

                <div className="rounded-lg p-3 bg-secondary/5 text-gray-900 border border-secondary/20">
                  <p className="text-sm whitespace-pre-wrap italic opacity-70">
                    {partialInterviewee}
                  </p>
                </div>
              </div>
            </div>
          )}

          {segments.length === 0 && !partialInterviewer && !partialInterviewee && (
            <div className="text-center py-8 text-gray-600">
              <Mic className="w-12 h-12 mx-auto mb-2 opacity-50 text-gray-400" />
              <p className="text-sm">
                En attente des premières transcriptions...
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
