"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inference_1 = require("@huggingface/inference");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, '../../.env') });
async function testRotation() {
    const rawTokens = process.env.HF_TOKENS || "";
    const tokens = rawTokens.split(',').map(t => t.trim()).filter(t => t);
    console.log(`🔍 Found ${tokens.length} tokens to test...`);
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        console.log(`\n--- Testing Token ${i + 1}/${tokens.length} ---`);
        const client = new inference_1.InferenceClient(token);
        try {
            console.log("🚀 Requesting image from stabilityai/stable-diffusion-xl-base-1.0...");
            const response = await client.textToImage({
                model: "stabilityai/stable-diffusion-xl-base-1.0",
                inputs: "Astronaut riding a horse",
            });
            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = `hf_success_token_${i + 1}.png`;
            fs.writeFileSync(fileName, buffer);
            console.log(`✅ SUCCESS! Token ${i + 1} worked.`);
            return;
        }
        catch (error) {
            console.error(`❌ FAILED: ${error.message}`);
        }
    }
    console.log("\n💀 ALL TOKENS FAILED.");
}
testRotation();
//# sourceMappingURL=test_hf_rotation.js.map