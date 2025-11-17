import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Lire les paramètres depuis les variables d'environnement
const SILENCE_THRESHOLD = parseInt(import.meta.env.VITE_SILENCE_THRESHOLD || "2000");
const RECORDING_CHUNK_DURATION = 500; // Vérifier toutes les 500ms
const VOLUME_THRESHOLD = parseFloat(import.meta.env.VITE_VOLUME_THRESHOLD || "5");
const MIN_RECORDING_DURATION = parseInt(import.meta.env.VITE_MIN_RECORDING_DURATION || "1000");

console.log("🎚️ Transcription settings:", {
  VOLUME_THRESHOLD,
  SILENCE_THRESHOLD,
  MIN_RECORDING_DURATION,
});

export interface TranscriptionBlock {
  speaker: "interviewer" | "interviewee";
  text: string;
  timestamp: number;
  audioEvents?: string[];
}

export class AudioTranscriptionService {
  private elevenlabs: ElevenLabsClient;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private silenceTimer: NodeJS.Timeout | null = null;
  private isRecording: boolean = false;
  private lastSoundTime: number = 0;
  private recordingStartTime: number = 0;
  private speaker: "interviewer" | "interviewee";
  private onTranscriptionComplete: (block: TranscriptionBlock) => void;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    speaker: "interviewer" | "interviewee",
    onTranscriptionComplete: (block: TranscriptionBlock) => void
  ) {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_ELEVENLABS_API_KEY is not set");
    }
    
    this.elevenlabs = new ElevenLabsClient({
      apiKey: apiKey,
    });
    
    this.speaker = speaker;
    this.onTranscriptionComplete = onTranscriptionComplete;
  }

  /**
   * Démarre l'enregistrement et la transcription d'un flux audio
   */
  async startTranscription(stream: MediaStream) {
    console.log(`[${this.speaker}] Starting transcription...`);

    // Créer le contexte audio pour détecter le silence
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    // Configurer MediaRecorder
    const options = { mimeType: "audio/webm" };
    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      await this.processRecording();
    };

    // Ne PAS démarrer l'enregistrement immédiatement
    // Attendre qu'il y ait du son (géré par startSilenceDetection)
    this.isRecording = false;
    this.lastSoundTime = Date.now();

    // Surveiller le niveau audio pour détecter le silence
    this.startSilenceDetection();
    
    console.log(`[${this.speaker}] Waiting for sound to start recording...`);
  }

  /**
   * Détecte quand l'utilisateur arrête de parler
   */
  private startSilenceDetection() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let checkCount = 0; // Pour log périodique

    this.silenceCheckInterval = setInterval(() => {
      if (!this.analyser) return;

      checkCount++;
      
      // Log périodique toutes les 20 vérifications (10 secondes)
      if (checkCount % 20 === 0) {
        console.log(`[${this.speaker}] Detection active - checks: ${checkCount}, recording: ${this.isRecording}`);
      }

      this.analyser.getByteTimeDomainData(dataArray);

      // Calculer le volume moyen
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const volume = rms * 100;

      // Si du son est détecté (volume > seuil)
      if (volume > VOLUME_THRESHOLD) {
        this.lastSoundTime = Date.now();
        
        // Si on n'était pas en train d'enregistrer, démarrer
        if (!this.isRecording) {
          const state = this.mediaRecorder?.state;
          
          if (state === "inactive") {
            console.log(`[${this.speaker}] Sound detected (volume: ${volume.toFixed(2)}), starting recording...`);
            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            try {
              this.mediaRecorder?.start();
              this.isRecording = true;
            } catch (error) {
              console.error(`[${this.speaker}] Error starting MediaRecorder:`, error);
            }
          } else if (state === "paused") {
            console.log(`[${this.speaker}] Resuming recording...`);
            this.mediaRecorder?.resume();
            this.isRecording = true;
          } else if (state === "recording" && !this.isRecording) {
            // Désynchronisation détectée ! Le MediaRecorder est en recording mais isRecording est false
            console.warn(`[${this.speaker}] ⚠️ Desync detected! Forcing stop...`);
            this.mediaRecorder.stop();
          }
        }
      } else {
        // Silence détecté (volume faible)
        
        // Si on est en train d'enregistrer, vérifier combien de temps de silence
        if (this.isRecording) {
          const silenceDuration = Date.now() - this.lastSoundTime;
          const recordingDuration = Date.now() - this.recordingStartTime;
          
          // Log du silence détecté
          if (silenceDuration > 1000 && silenceDuration % 1000 < 500) {
            console.log(`[${this.speaker}] Silence: ${(silenceDuration / 1000).toFixed(1)}s, recording: ${(recordingDuration / 1000).toFixed(1)}s`);
          }
          
          // Si silence > 2 secondes ET enregistrement > 1 seconde
          if (silenceDuration > SILENCE_THRESHOLD && recordingDuration > MIN_RECORDING_DURATION) {
            console.log(`[${this.speaker}] ✂️ Silence detected for 2s (recording duration: ${recordingDuration}ms), stopping recording...`);
            const state = this.mediaRecorder?.state;
            if (state === "recording") {
              this.isRecording = false;
              this.mediaRecorder.stop();
            } else {
              console.warn(`[${this.speaker}] ⚠️ Wanted to stop but state is: ${state}`);
              this.isRecording = false;
            }
          }
        }
      }
    }, RECORDING_CHUNK_DURATION);
  }

  /**
   * Traite l'enregistrement et l'envoie à ElevenLabs
   */
  private async processRecording() {
    if (this.audioChunks.length === 0) {
      console.log(`[${this.speaker}] No audio chunks to process`);
      return;
    }

    // Vérifier la durée de l'enregistrement
    const recordingDuration = Date.now() - this.recordingStartTime;
    if (recordingDuration < MIN_RECORDING_DURATION) {
      console.log(`[${this.speaker}] Recording too short (${recordingDuration}ms), ignoring...`);
      this.audioChunks = [];
      this.isRecording = false;
      return;
    }

    console.log(`[${this.speaker}] Processing ${this.audioChunks.length} audio chunks (duration: ${recordingDuration}ms)...`);

    try {
      // Créer un blob audio
      const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
      
      // Convertir en format compatible (wav ou mp3)
      const convertedBlob = await this.convertToWav(audioBlob);
      
      console.log(`[${this.speaker}] Sending to ElevenLabs API...`);

      // Send to ElevenLabs - Force English transcription
      const transcription = await this.elevenlabs.speechToText.convert({
        file: convertedBlob,
        modelId: "scribe_v1",
        tagAudioEvents: true,
        languageCode: "eng", // Force English transcription
        diarize: false, // No need for diarization as we already separated streams
      });

      console.log(`[${this.speaker}] Transcription received:`, transcription);

      // Extraire le texte de la réponse
      const transcriptionText = (transcription as any).text || 
                                (transcription as any).transcript || 
                                "";

      // Ne pas envoyer de transcription vide
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        console.log(`[${this.speaker}] Empty transcription, skipping...`);
        return;
      }

      // Callback avec le résultat
      this.onTranscriptionComplete({
        speaker: this.speaker,
        text: transcriptionText,
        timestamp: Date.now(),
        audioEvents: (transcription as any).audioEvents,
      });

    } catch (error) {
      console.error(`[${this.speaker}] Error during transcription:`, error);
      if (error instanceof Error) {
        console.error(`[${this.speaker}] Error details:`, error.message, error.stack);
      }
    } finally {
      // Réinitialiser pour le prochain enregistrement
      this.audioChunks = [];
      this.lastSoundTime = Date.now();
      this.isRecording = false;
      
      console.log(`[${this.speaker}] Ready for next recording... (MediaRecorder state: ${this.mediaRecorder?.state})`);
    }
  }

  /**
   * Convertit le blob audio en WAV pour compatibilité
   */
  private async convertToWav(blob: Blob): Promise<Blob> {
    // Pour simplifier, on retourne le blob original
    // Dans un cas réel, vous devriez le convertir en WAV avec une lib comme lamejs
    return blob;
  }

  /**
   * Arrête la transcription
   */
  stop() {
    console.log(`[${this.speaker}] Stopping transcription...`);
    
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
    }
    
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.isRecording = false;
  }
}
