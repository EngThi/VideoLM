import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  const ai = new GoogleGenAI({
    apiKey: apiKey
  });

  const prompt = "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";

  console.log("🚀 Solicitando geração de imagem ao modelo: gemini-2.5-flash-image");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (!response.candidates || response.candidates.length === 0) {
      console.log("Nenhum candidato retornado.");
      return;
    }

    let imageFound = false;
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        console.log("Texto do modelo:", part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");
        fs.writeFileSync("gemini-native-image.png", buffer);
        console.log("✅ SUCESSO! Imagem salva como gemini-native-image.png");
        imageFound = true;
      }
    }
    
    if (!imageFound) {
      console.log("ℹ️  O modelo respondeu, mas não encontrei dados de imagem inline.");
      console.log("Resposta completa:", JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error("❌ Erro:", error.message);
    if (error.response) {
        // Tenta mostrar mensagem de erro mais detalhada se disponível
        try {
            console.error("Detalhes do erro:", JSON.stringify(error.response, null, 2));
        } catch (e) {
            console.error("Detalhes do erro (bruto):", error.response);
        }
    }
  }
}

main();