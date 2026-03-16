import { InferenceClient } from "@huggingface/inference";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function testHF() {
    const token = process.env.HF_TOKEN;
    if (!token) return;

    const client = new InferenceClient(token);

    try {
        console.log("🚀 Testing SDXL (Less restrictive model)...");
        const response = await client.textToImage({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            inputs: "Astronaut riding a horse",
        });

        const buffer = Buffer.from(await (response as any).arrayBuffer());
        fs.writeFileSync('hf_test_result_sdxl.png', buffer);
        console.log("✅ SUCCESS! Image saved as hf_test_result_sdxl.png");
    } catch (error) {
        console.error("❌ FAILED:", error.message);
    }
}

testHF();
