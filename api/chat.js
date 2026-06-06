// api/chat.js
export default async function handler(req, res) {
    // CORS Headers සකස් කිරීම
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // 🛡️ Vercel Environment Variables වලින් රහස් කී එක ඇදලා ගැනීම
        const apiKey = process.env.OPENROUTER_KEY;
        
        if (!apiKey) {
            console.error("Missing OPENROUTER_KEY in Vercel Environment Variables!");
            return res.status(500).json({ error: true, reply: "🤖 CraftMeet AI: OPENROUTER_KEY missing in Vercel Matrix!" });
        }

        // CraftMeet AI Character Rules
        const systemInstruction = "You are CraftMeet AI, a friendly pro Sri Lankan gamer and tech assistant integrated into the CraftMeet platform built by Mr_kaveeya_bro. Keep your answer under 2 sentences, use gaming slang like GG, Clutch, and reply directly to this user: ";
        const fullPrompt = systemInstruction + message;

        // ⚡ ආරක්ෂිතව API එකට කෝල් එක දීම
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://craftmeet.vercel.app", 
                "X-Title": "CraftMeet AI",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                // 🔥 100% ක්ම දැනට OpenRouter එකේ වැඩ කරන නිවැරදි Free Model එක මෙන්න:
                model: "meta-llama/llama-3.2-3b-instruct:free", 
                messages: [{ role: "user", content: fullPrompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("AI API Error Details:", errText);
            throw new Error(`AI core dropped packet with status ${response.status}`);
        }

        const data = await response.json();
        const aiReply = data.choices?.[0]?.message?.content || "GG! Stream sync established but no data returned.";

        return res.status(200).json({ reply: aiReply.trim() });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: true, reply: `🤖 CraftMeet AI: Core dropped packet inside server grid! (${error.message})` });
    }
}
