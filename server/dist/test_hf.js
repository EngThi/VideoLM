"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inference_1 = require("@huggingface/inference");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
async function testHF() {
    const token = process.env.HF_TOKEN;
    if (!token)
        return;
    const client = new inference_1.InferenceClient(token);
    try {
        console.log("🚀 Testing SDXL (Less restrictive model)...");
        const response = await client.textToImage({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            inputs: "Astronaut riding a horse",
        });
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync('hf_test_result_sdxl.png', buffer);
        console.log("✅ SUCCESS! Image saved as hf_test_result_sdxl.png");
    }
    catch (error) {
        console.error("❌ FAILED:", error.message);
    }
}
testHF();
//# sourceMappingURL=test_hf.js.map