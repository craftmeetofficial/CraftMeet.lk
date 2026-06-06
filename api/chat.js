// api/chat.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const apiKey = process.env.OPENROUTER_KEY;
        if (!apiKey) return res.status(500).json({ error: true, reply: "🤖 CraftMeet AI: OPENROUTER_KEY missing!" });

        const systemInstruction = "You are CraftMeet AI, a friendly pro Sri Lankan gamer and tech assistant integrated into the CraftMeet platform built by Mr_kaveeya_bro. Keep your answer under 2 sentences, use gaming slang like GG, Clutch, and reply directly to this user: ";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://craftmeet.vercel.app", 
                "X-Title": "CraftMeet AI",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                // 🎯 FIXED: Updated to Meta LLaMA 3 8B Instruct (100% Free & Active on OpenRouter)
                model: "meta-llama/llama-3-8b-instruct:free", 
                messages: [{ role: "user", content: systemInstruction + message }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("AI API Error Details:", errText);
            throw new Error(`AI core status ${response.status}`);
        }

        const data = await response.json();
        const aiReply = data.choices?.[0]?.message?.content || "GG! Stream sync established but no data returned.";
        return res.status(200).json({ reply: aiReply.trim() });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: true, reply: `🤖 CraftMeet AI: Core dropped packet inside server grid! (${error.message})` });
    }
}
