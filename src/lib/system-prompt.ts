import { buildPortfolioPrompt } from "./chat-prompt";

// Texto e voz usam a mesma base publicada; aqui só muda a modalidade.
export const SYSTEM_PROMPT = buildPortfolioPrompt("voice");
