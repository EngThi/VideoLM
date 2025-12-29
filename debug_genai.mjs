import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenAI(apiKey);
    
    console.log("Tipo de genAI:", typeof genAI);
    console.log("Métodos disponíveis:", Object.keys(genAI));
    
    if (typeof genAI.getGenerativeModel === 'function') {
        console.log("✅ getGenerativeModel existe!");
    } else {
        console.log("❌ getGenerativeModel NÃO existe!");
    }
}

test();
