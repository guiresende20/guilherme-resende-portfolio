const apiKey = "AIzaSyAq6o3a8eihL-v-l9bKNe2vPI-wYAcVhaU";

const wssUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WebSocket(wssUrl);

ws.onopen = () => {
    ws.send(JSON.stringify({
        setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
                responseModalities: ["AUDIO"]
            }
        }
    }));
};

ws.onmessage = async (event) => {
    let text = event.data;
    if (text instanceof Blob) {
      text = await text.text();
    }
    const data = JSON.parse(text);
    if (data.setupComplete) {
        console.log("Setup complete, sending audio chunk...");
        const chunk = Buffer.from("00000000").toString("base64"); 
        
        ws.send(JSON.stringify({
            realtimeInput: {
                audio: {
                    mimeType: "audio/pcm;rate=16000",
                    data: chunk
                }
            }
        }));
    } else {
        console.log("msg", data)
    }
};

ws.onerror = e => console.log("err", e.message);

ws.onclose = (event) => {
    console.log(`[WS Close] Code: ${event.code}, Reason: ${event.reason}`);
    process.exit(event.code);
};
