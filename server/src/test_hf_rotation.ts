import { InferenceClient } from "@huggingface/inference";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testRotation() {
    const rawTokens = process.env.HF_TOKENS || "";
    const tokens = rawTokens.split(',').map(t => t.trim()).filter(t => t);
    
    console.log(`🔍 Found ${tokens.length} tokens to test...`);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        console.log(`\n--- Testing Token ${i + 1}/${tokens.length} ---`);
        
        const client = new InferenceClient(token);

        try {
            console.log("🚀 Requesting image from stabilityai/stable-diffusion-xl-base-1.0...");
            const response = await client.textToImage({
                model: "stabilityai/stable-diffusion-xl-base-1.0",
                inputs: "Astronaut riding a horse",
            });

            const buffer = Buffer.from(await (response as any).arrayBuffer());
            const fileName = `hf_success_token_${i + 1}.png`;
            fs.writeFileSync(fileName, buffer);
            console.log(`✅ SUCCESS! Token ${i + 1} worked.`);
            return;
        } catch (error) {
            console.error(`❌ FAILED: ${error.message}`);
        }
    }
    console.log("\n💀 ALL TOKENS FAILED.");
}

testRotation();
