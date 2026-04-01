const WebSocket = require('ws');
const wssUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
const ws = new WebSocket(wssUrl);
ws.on('open', () => {
  const setup = {
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      generationConfig: {
        responseModalities: ['AUDIO'],
        thinkingConfig: { thinkingLevel: 'low' },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }
          }
        }
      },
      systemInstruction: { parts: [{ text: 'Hello' }] }
    }
  };
  ws.send(JSON.stringify(setup));
});
ws.on('message', (data) => {
  console.log('MSG:', data.toString());
  ws.close();
});
ws.on('error', (e) => console.log('ERR:', e));
