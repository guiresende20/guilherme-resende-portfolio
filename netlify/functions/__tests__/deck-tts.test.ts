import { describe, it, expect } from "vitest";
import { normalizeTtsAudio } from "../deck-tts";

function chunk(id: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.write(id, 0, "ascii");
  head.writeUInt32LE(payload.length, 4);
  return Buffer.concat([head, payload, payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function wav(pcm: Buffer, { rate = 24000, bits = 16, channels = 1, extra = [] as Buffer[] } = {}): string {
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * channels * (bits / 8), 8);
  fmt.writeUInt16LE(channels * (bits / 8), 12);
  fmt.writeUInt16LE(bits, 14);
  const body = Buffer.concat([Buffer.from("WAVE"), chunk("fmt ", fmt), chunk("data", pcm), ...extra]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]).toString("base64");
}

describe("normalizeTtsAudio", () => {
  const pcm = Buffer.from([1, 2, 3, 4, 5, 6]);

  it("passes raw L16 PCM through and reads the rate from the mime", () => {
    const b64 = pcm.toString("base64");
    expect(normalizeTtsAudio(b64, "audio/L16;codec=pcm;rate=24000")).toEqual({ audioBase64: b64, sampleRate: 24000 });
  });

  it("strips the WAV header and returns only the data chunk", () => {
    const out = normalizeTtsAudio(wav(pcm, { rate: 22050 }), "audio/wav");
    expect(out).toEqual({ audioBase64: pcm.toString("base64"), sampleRate: 22050 });
  });

  it("ignores chunks after data (e.g. LIST metadata)", () => {
    const out = normalizeTtsAudio(wav(pcm, { extra: [chunk("LIST", Buffer.from("INFOxxxx"))] }), "audio/wav");
    expect(out?.audioBase64).toBe(pcm.toString("base64"));
  });

  it("rejects WAV that is not 16-bit mono PCM", () => {
    expect(normalizeTtsAudio(wav(pcm, { channels: 2 }), "audio/wav")).toBeNull();
    expect(normalizeTtsAudio(wav(pcm, { bits: 8 }), "audio/wav")).toBeNull();
  });

  it("rejects truncated WAV", () => {
    expect(normalizeTtsAudio(Buffer.from("RIFF\0\0\0\0WAVE").toString("base64"), "audio/wav")).toBeNull();
  });
});
