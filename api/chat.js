// api/chat.js
export default async function handler(req, res) {
    // CORS Headers සෙට් කරනවා වෙනත් ඩොමේන් එකකින් ආවත් රික්වෙස්ට් බ්ලොක් නොවෙන්න
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Browser එකෙන් එවන Preflight (OPTIONS) රික්වෙස්ට් එකක් ආවොත් කෙලින්ම සක්සස් කරනවා
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message content is missing' });
        }

        // 🚀 පියවර 1: DuckDuckGo එකෙන් Token එකක් (VQD) ගන්නවා (Vercel සර්වර් එක ඇතුලෙන්ම)
        const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
            headers: { "x-requested-with": "XMLHttpRequest" }
        });
        
        const vqdToken = statusRes.headers.get("x-vqd-4") || "1-111111111111111111-111111111111111111";

        // 🚀 පියවර 2: ඒ ගත්ත Token එකත් එක්ක DuckDuckGo Chat Core එකට කෙලින්ම කෝල් එක දානවා
        const systemInstruction = "You are CraftMeet AI, a friendly pro Sri Lankan gamer and tech assistant integrated into the CraftMeet platform built by Mr_kaveeya_bro. Keep your answer under 2 sentences, use gaming slang like GG, Clutch, and reply directly to this user: ";
        
        const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-vqd-4": vqdToken,
                "Accept": "text/event-stream"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: systemInstruction + message }]
            })
        });

        if (!chatRes.ok) throw new Error("DuckDuckGo core API dropped packet");

        const rawText = await chatRes.text();
        
        // එන Response stream එකෙන් Text එක විතරක් වෙන් කරගන්නවා
        const lines = rawText.split('\n');
        let aiReplyText = "";

        for (let line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6).trim();
                if (dataStr === '[DONE]') break;
                try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.message) aiReplyText += parsed.message;
                } catch (e) {}
            }
        }

        // අවසාන පිළිතුර Client (Front-end) එකට යවනවා
        return res.status(200).json({ reply: aiReplyText.trim() });

    } catch (error) {
        console.error("Vercel Edge Error:", error);
        return res.status(500).json({ error: "AI Uplink Failed" });
    }
}