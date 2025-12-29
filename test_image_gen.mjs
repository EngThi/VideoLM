import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ ERRO: GEMINI_API_KEY não encontrada no environment.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: apiKey });

async function testImageGen() {
    console.log("🧪 Testando geração de imagem...");
    
    // 1. Try the model name used in your code
    console.log("\n[TESTE 1] Tentando 'gemini-2.5-flash-image' (usado no seu projeto)...");
    try {
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: 'A painting of a cute cat' }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9"
                }
            }
        });
        console.log("✅ Sucesso com 'gemini-2.5-flash-image'!");
        // console.log(JSON.stringify(response, null, 2));
    } catch (err) {
        console.error("❌ FALHA com 'gemini-2.5-flash-image':");
        console.error(`   Status: ${err.status}`);
        console.error(`   Message: ${err.message}`);
    }

    // 2. Try the standard Imagen 3 model name
    console.log("\n[TESTE 2] Tentando 'imagen-3.0-generate-001' (padrão recomendado)...");
    try {
        const response = await ai.models.generateImage({
            model: 'imagen-3.0-generate-001',
            prompt: 'A painting of a cute cat',
            config: {
                aspectRatio: '16:9',
                number: 1
            }
        });
        console.log("✅ Sucesso com 'imagen-3.0-generate-001'!");
    } catch (err) {
        console.error("❌ FALHA com 'imagen-3.0-generate-001':");
        console.error(`   Status: ${err.status}`);
        console.error(`   Message: ${err.message}`);
    }
}

testImageGen();