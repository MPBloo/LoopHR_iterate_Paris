import { supabase } from "@/integrations/supabase/client";

const ROOM_ID = "main-room"; // Salle unique pour tous
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class WebRTCConnection {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private senderId: string;
  private onRemoteStream: (stream: MediaStream) => void;
  private channel: any = null;

  constructor(senderId: string, onRemoteStream: (stream: MediaStream) => void) {
    this.senderId = senderId;
    this.onRemoteStream = onRemoteStream;
  }

  async initialize(localStream: MediaStream) {
    this.localStream = localStream;
    
    // Create peer connection
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    localStream.getTracks().forEach(track => {
      this.pc!.addTrack(track, localStream);
    });

    // Handle remote stream
    this.pc.ontrack = (event) => {
      console.log("Received remote track", event.streams[0]);
      this.onRemoteStream(event.streams[0]);
    };

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate");
        this.sendSignalingMessage("ice-candidate", {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Subscribe to signaling messages
    this.subscribeToSignaling();

    // Create and send offer
    await this.createOffer();
  }

  private async createOffer() {
    if (!this.pc) return;

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      
      console.log("Sending offer");
      await this.sendSignalingMessage("offer", {
        sdp: offer.sdp,
        type: offer.type,
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  private async sendSignalingMessage(type: string, payload: any) {
    try {
      const { error } = await supabase.from("signaling_messages").insert({
        room_id: ROOM_ID,
        sender_id: this.senderId,
        message_type: type,
        payload,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error sending signaling message:", error);
    }
  }

  private subscribeToSignaling() {
    this.channel = supabase
      .channel(`signaling-${ROOM_ID}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signaling_messages",
          filter: `room_id=eq.${ROOM_ID}`,
        },
        async (payload) => {
          const message = payload.new as any;
          
          // Ignore own messages
          if (message.sender_id === this.senderId) return;

          console.log("Received signaling message:", message.message_type);

          try {
            switch (message.message_type) {
              case "offer":
                await this.handleOffer(message.payload);
                break;
              case "answer":
                await this.handleAnswer(message.payload);
                break;
              case "ice-candidate":
                await this.handleIceCandidate(message.payload);
                break;
            }
          } catch (error) {
            console.error("Error handling signaling message:", error);
          }
        }
      )
      .subscribe();
  }

  private async handleOffer(payload: any) {
    if (!this.pc) return;

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      
      console.log("Sending answer");
      await this.sendSignalingMessage("answer", {
        sdp: answer.sdp,
        type: answer.type,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  private async handleAnswer(payload: any) {
    if (!this.pc) return;

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
      console.log("Answer set successfully");
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }

  private async handleIceCandidate(payload: any) {
    if (!this.pc) return;

    try {
      const candidate = new RTCIceCandidate(payload.candidate);
      await this.pc.addIceCandidate(candidate);
      console.log("ICE candidate added");
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }

  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}
