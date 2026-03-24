import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testOpenRouterImage() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("❌ OPENROUTER_API_KEY not found");
        return;
    }

    console.log("🚀 Requesting image from OpenRouter (black-forest-labs/flux.2-max)...");
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'black-forest-labs/flux.2-max',
                messages: [{ role: 'user', content: 'A hyper-realistic 3D mathematical fractal, neon purple and gold, 8k resolution' }],
            }),
        });

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
            console.log("✅ SUCCESS!");
            console.log("Content received (first 100 chars):", content.substring(0, 100));
            if (content.startsWith('http')) {
                console.log("🔗 Image URL:", content);
            } else if (content.startsWith('data:image')) {
                console.log("🖼️ Image Data: Base64 received");
            } else {
                console.log("📝 Text response received instead of image data. Content:", content);
            }
        } else {
            console.error("❌ No content in response:", JSON.stringify(data));
        }
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}

testOpenRouterImage();
