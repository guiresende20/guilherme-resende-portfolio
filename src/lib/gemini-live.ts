// src/lib/gemini-live.ts

// Esta biblioteca gerencia a conexão via WebSocket com a Gemini Multimodal Live API.
// Ela lida com a captura do microfone, envio de áudio e reprodução da resposta do modelo.

export type LiveChatStatus = "disconnected" | "connecting" | "connected" | "listening" | "speaking" | "error";

export interface LiveChatCallbacks {
  onStatusChange: (status: LiveChatStatus) => void;
  onTextAction?: (text: string) => void;
  onError?: (error: string) => void;
}

export class GeminiLiveChat {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  // Fila de áudio para reprodução contínua
  private playedFrames = 0;
  private nextPlayTime = 0;

  constructor(
    private apiKey: string,
    private callbacks: LiveChatCallbacks,
    private systemInstruction: string
  ) {}

  public async start() {
    this.callbacks.onStatusChange("connecting");

    try {
      // 1. Iniciar AudioContext (precisa de interação do usuário antes)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Gemini espera 16kHz para input
      });

      // 2. Conectar WebSocket
      const wssUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(wssUrl);

      this.ws.onopen = () => {
        // Enviar setup inicial
        const setup = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Puck", // Voz masculina
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: this.systemInstruction }]
            }
          }
        };
          console.log("[Gemini Live] Sending Setup:", setup);
          this.ws?.send(JSON.stringify(setup));
        };

      this.ws.onmessage = async (event) => {
        let msg;
        try {
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            msg = JSON.parse(text);
          } else {
            msg = JSON.parse(event.data);
          }
        } catch (e) {
          console.error("Erro no parse do WebSocket:", e);
          return;
        }

        console.log("[Gemini Live] Received JSON:", msg); // LOG IMPORTANTE

        if (msg.error) {
           this.callbacks.onError?.(`API Error: ${msg.error.message || JSON.stringify(msg.error)}`);
           this.stop();
           return;
        }

        if (msg.setupComplete) {
          this.callbacks.onStatusChange("connected");
          await this.startRecording();
          return;
        }

        if (msg.serverContent?.modelTurn) {
          this.callbacks.onStatusChange("speaking");
          const parts = msg.serverContent.modelTurn.parts;
          for (const part of parts) {
            // Pode retornar texto (transcrição) e áudio
            if (part.text && this.callbacks.onTextAction) {
              this.callbacks.onTextAction(part.text);
            }
            if (part.inlineData && part.inlineData.data) {
              const base64Data = part.inlineData.data;
              this.playAudioChunk(base64Data);
            }
          }
        }

        // Se o turno do servidor terminou, voltamos a "escutar"
        if (msg.serverContent?.turnComplete) {
           this.callbacks.onStatusChange("listening");
        }
      };

      this.ws.onerror = (e) => {
        console.error("WebSocket Error: ", e);
        this.callbacks.onError?.("Erro de conexão (Falha no handshake WSS)");
        this.stop();
      };

      this.ws.onclose = (event) => {
        console.log(`[Gemini Live] WS Closed: Code=${event.code}, Reason=${event.reason || "vazio"}`);
        this.callbacks.onStatusChange("disconnected");
        this.stop();
      };
    } catch (e) {
      console.error(e);
      this.callbacks.onError?.("Não foi possível acessar a câmera/microfone ou conectar à API.");
      this.stop();
    }
  }

  private async startRecording() {
    if (!this.audioContext) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Node para capturar blocos de áudio (obsoleto, mas seguro e vastamente suportado no Safari/Mobile)
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Converter Float32 (1.0 a -1.0) para PCM Int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Enviar chunk via WebSockets em Base64
        const base64Chunk = this.bufferToBase64(pcm16.buffer);
        const msg = {
          realtimeInput: {
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: base64Chunk
            }
          }
        };
        this.ws.send(JSON.stringify(msg));
      };

      this.callbacks.onStatusChange("listening");

    } catch (err) {
      console.error("Permissão de microfone negada.", err);
      this.callbacks.onError?.("Permissão de microfone negada.");
      this.stop();
    }
  }

  // Reproduzir o aúdio recebido da IA
  private async playAudioChunk(base64Data: string) {
    if (!this.audioContext) return;

    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // O retorno da API Live é PCM de 24kHz, 16-bit
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    audioBuffer.copyToChannel(float32Data, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Agendar reprodução sem furos
    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
  }

  // Função utilitária
  private bufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Finalizar sessão
  public stop() {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
          const clientContent = {
              clientContent: {
                  turnComplete: true
              }
          };
          this.ws.send(JSON.stringify(clientContent));
      }
      this.ws.close();
      this.ws = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.callbacks.onStatusChange("disconnected");
  }
}
