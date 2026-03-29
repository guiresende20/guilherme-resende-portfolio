const apiKey = "AIzaSyAq6o3a8eihL-v-l9bKNe2vPI-wYAcVhaU";

const wssUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WebSocket(wssUrl);

ws.onopen = () => {
    ws.send(JSON.stringify({
        setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Aoede"
                        }
                    }
                }
            }
        }
    }));
};

ws.onmessage = (event) => {
    console.log(`msg:`, event.data);
};

ws.onclose = (event) => {
    console.log(`close:`, event.code, event.reason);
};
