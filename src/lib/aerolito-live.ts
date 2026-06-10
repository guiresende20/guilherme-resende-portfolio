// Variante do Gemini Live para o /aerolito:
// - Input via texto (não via mic)
// - Output: áudio + transcrição (outputTranscription)
// - Sync typing: cada chunk de transcrição vira evento; consumer atualiza UI char-by-char
// - Suporta enviar turns como role=model (para falar perguntas fixas sem alucinação)

export type AerolitoLiveStatus = "disconnected" | "connecting" | "connected" | "speaking" | "idle" | "error";

export interface AerolitoLiveCallbacks {
  onStatusChange: (status: AerolitoLiveStatus) => void;
  onTranscriptChunk: (text: string) => void;     // cada chunk parcial
  onTurnComplete?: (fullText: string) => void;   // chamado ao fim do turn (texto completo)
  onError?: (error: string) => void;
}

export class AerolitoLiveChat {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private currentTranscript = "";
  private setupResolve: (() => void) | null = null;
  private setupReject: ((err: Error) => void) | null = null;
  private setupTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ephemeralToken: string,
    private callbacks: AerolitoLiveCallbacks,
    private systemInstruction: string,
  ) {}

  public start(): Promise<void> {
    this.callbacks.onStatusChange("connecting");
    return new Promise<void>((resolve, reject) => {
      this.setupResolve = resolve;
      this.setupReject = reject;
      // Hard timeout: se setupComplete não chegar em 10s, falha.
      this.setupTimeout = setTimeout(() => {
        if (this.setupReject) {
          const err = new Error("setupComplete timeout");
          this.setupReject(err);
          this.setupResolve = null;
          this.setupReject = null;
          this.callbacks.onError?.("Tempo esgotado ao conectar com a voz.");
          this.stop();
        }
      }, 10000);

      try {
        this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
          sampleRate: 24000,
        });

        const wssUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(this.ephemeralToken)}`;
        this.ws = new WebSocket(wssUrl);

        this.ws.onopen = () => {
          const setup = {
            setup: {
              model: "models/gemini-3.1-flash-live-preview",
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
                  languageCode: "pt-BR",
                },
              },
              systemInstruction: { parts: [{ text: this.systemInstruction }] },
              outputAudioTranscription: {},
            },
          };
          this.ws?.send(JSON.stringify(setup));
        };

        this.ws.onmessage = async (event) => {
          let msg: unknown;
          try {
            const text = event.data instanceof Blob ? await event.data.text() : (event.data as string);
            msg = JSON.parse(text);
          } catch (e) {
            console.error("aerolito-live: parse failed", e);
            return;
          }
          this.handleMessage(msg);
        };

        this.ws.onerror = (e) => {
          console.error("aerolito-live: ws error", e);
          this.callbacks.onError?.("Erro de conexão");
          if (this.setupReject) {
            this.setupReject(new Error("ws error before setupComplete"));
            this.setupResolve = null;
            this.setupReject = null;
          }
          this.stop();
        };

        this.ws.onclose = () => {
          this.callbacks.onStatusChange("disconnected");
        };
      } catch (e) {
        console.error("aerolito-live: start failed", e);
        this.callbacks.onError?.("Não foi possível iniciar a voz.");
        if (this.setupReject) {
          this.setupReject(e instanceof Error ? e : new Error(String(e)));
          this.setupResolve = null;
          this.setupReject = null;
        }
        this.stop();
      }
    });
  }

  private handleMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") return;
    const obj = msg as Record<string, unknown>;

    if (obj.error) {
      this.callbacks.onError?.(`API Error: ${JSON.stringify(obj.error)}`);
      this.stop();
      return;
    }

    if (obj.setupComplete) {
      this.callbacks.onStatusChange("connected");
      this.callbacks.onStatusChange("idle");
      if (this.setupTimeout) { clearTimeout(this.setupTimeout); this.setupTimeout = null; }
      this.setupResolve?.();
      this.setupResolve = null;
      this.setupReject = null;
      return;
    }

    const serverContent = obj.serverContent as Record<string, unknown> | undefined;
    if (!serverContent) return;

    // Transcrição do áudio que estamos tocando (sincroniza typing)
    const outputTranscription = serverContent.outputTranscription as { text?: string } | undefined;
    if (outputTranscription?.text) {
      this.currentTranscript += outputTranscription.text;
      this.callbacks.onTranscriptChunk(outputTranscription.text);
    }

    const modelTurn = serverContent.modelTurn as { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> } | undefined;
    if (modelTurn?.parts) {
      this.callbacks.onStatusChange("speaking");
      for (const part of modelTurn.parts) {
        if (part.inlineData?.data) this.playAudioChunk(part.inlineData.data);
      }
    }

    if (serverContent.turnComplete) {
      this.callbacks.onStatusChange("idle");
      const full = this.currentTranscript;
      this.currentTranscript = "";
      this.callbacks.onTurnComplete?.(full);
    }
  }

  /**
   * Normaliza pronúncia: "Aeroli.to" / "aeroli.to" -> "Aérolito" / "aérolito".
   * Dois problemas que isso resolve: (1) o ponto entre Aeroli e to faz o TTS
   * pausar como "Aeroli ponto to"; (2) sem acento a tônica cai errada (ae-ro-LI-to).
   * Com "aérolito" a voz diz "a-É-ro-li-to", a pronúncia correta da empresa.
   * Aplicado em todo texto enviado ao Live API.
   */
  private normalizePronunciation(text: string): string {
    return text.replace(/aeroli\.to/gi, (match) => match[0] === "A" ? "Aérolito" : "aérolito");
  }

  /** Envia texto do colega como user turn (modo normal). */
  public sendUserText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: this.normalizePronunciation(text) }] }],
        turnComplete: true,
      },
    }));
  }

  /** Faz a IA falar exatamente este texto (sem geração — usado para as 5 perguntas fixas). */
  public sayFixed(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const spoken = this.normalizePronunciation(text);
    // Instrução literal para a IA reproduzir o texto sem alterar.
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: `Diga exatamente este texto, sem adicionar nada, sem comentar, sem trocar palavras: "${spoken}"` }],
        }],
        turnComplete: true,
      },
    }));
  }

  private playAudioChunk(base64Data: string): void {
    if (!this.audioContext) return;
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 32768.0;

    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    audioBuffer.copyToChannel(float32Data, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) this.nextPlayTime = currentTime;
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    this.scheduledSources.push(source);
    source.onended = () => {
      this.scheduledSources = this.scheduledSources.filter((s) => s !== source);
    };
  }

  public stop(): void {
    if (this.setupTimeout) { clearTimeout(this.setupTimeout); this.setupTimeout = null; }
    this.setupResolve = null;
    this.setupReject = null;
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    for (const s of this.scheduledSources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    this.scheduledSources = [];
    if (this.audioContext) {
      try { this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }
    this.callbacks.onStatusChange("disconnected");
  }
}
