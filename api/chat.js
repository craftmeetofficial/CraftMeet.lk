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

        // CraftMeet AI Character Rules
        const systemInstruction = "You are CraftMeet AI, a friendly pro Sri Lankan gamer and tech assistant integrated into the CraftMeet platform built by Mr_kaveeya_bro. Keep your answer under 2 sentences, use gaming slang like GG, Clutch, and reply directly to this user: ";
        const fullPrompt = systemInstruction + message;

        // ⚡ කිසිම බ්ලොක් වීමක් නැති නොමිලේ වැඩ කරන විශ්වාසවන්ත AI API එකක් භාවිතා කිරීම
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer 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", // පොදු නිදහස් කී එකක්
                "HTTP-Referer": "https://craftmeet.vercel.app", 
                "X-Title": "CraftMeet AI",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.2-3b-instruct:free", // නියම Gaming Slang දන්නා වේගවත් නොමිලේ දෙන මොඩලයක්
                messages: [{ role: "user", content: fullPrompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("AI API Error Details:", errText);
            throw new Error("AI core dropped packet");
        }

        const data = await response.json();
        const aiReply = data.choices?.[0]?.message?.content || "";

        return res.status(200).json({ reply: aiReply.trim() });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
