# 🔄 Guia do Sistema de Rotação de APIs de Imagem

Este documento explica o novo sistema de **Fallback e Rotação de APIs** implementado no projeto. O objetivo é garantir que a geração de vídeos nunca falhe, mesmo que a API principal (Gemini/Google) atinja o limite de cota ou saia do ar.

---

## 🚀 Como Funciona a Orquestração

O sistema agora tenta gerar a imagem sequencialmente. Se a **Opção 1** falhar (erro 429, 500, ou falta de chave), ele pula automaticamente para a **Opção 2**, e assim por diante.

### A Ordem de Prioridade

1.  **🥇 Gemini (Imagen 3)**
    *   **Status:** Principal.
    *   **Por que:** Mais rápido, nativo do ecossistema Google, alta qualidade.
    *   **Config:** Usa `GEMINI_API_KEY`.

2.  **🥈 Hugging Face Inference API**
    *   **Status:** Backup Robusto.
    *   **Modelo:** `stabilityai/stable-diffusion-xl-base-1.0`.
    *   **Por que:** Tier gratuito muito generoso e rápido.
    *   **Config:** Requer `HF_TOKEN`.

3.  **🥉 Stable Diffusion API**
    *   **Status:** Terciário.
    *   **Modelo:** SDXL / Standard.
    *   **Por que:** Oferece créditos gratuitos iniciais.
    *   **Config:** Requer `STABLE_DIFFUSION_KEY`.

4.  **🛡️ Craiyon (DALL-E Mini)**
    *   **Status:** "Hail Mary" (Último recurso gratuito).
    *   **Por que:** Não exige chave de API obrigatoriamente, mas é mais lento e a qualidade é inferior (estilo artístico/abstract).
    *   **Config:** Nenhuma chave obrigatória.

5.  **💎 Replicate**
    *   **Status:** Premium Backup.
    *   **Modelo:** Stable Diffusion / Flux.
    *   **Por que:** Altíssima qualidade, mas o tier gratuito é limitado por tempo de processamento.
    *   **Config:** Requer `REPLICATE_TOKEN`.

---

## ⚙️ Configuração (Como Ativar)

Para ativar os backups, você precisa obter as chaves (a maioria tem planos gratuitos) e adicioná-las ao seu arquivo `.env`:

```env
# --- Principal ---
GEMINI_API_KEY=sua_chave_aqui

# --- Backups (Adicione estas linhas) ---

# 1. Hugging Face (Crie um token "Write" em hf.co/settings/tokens)
HF_TOKEN=hf_...

# 2. Stable Diffusion API (stablediffusionapi.com)
STABLE_DIFFUSION_KEY=sua_chave_sd_api

# 3. Replicate (replicate.com/account/api-tokens)
REPLICATE_TOKEN=r8_...
```

> **Nota:** Se você não colocar uma chave no `.env`, o sistema simplesmente pulará aquele provedor e tentará o próximo.

---

## 🛠️ O Que Foi Alterado no Código?

### 1. `vite.config.ts`
As novas variáveis de ambiente foram expostas para o frontend React de forma segura:
```typescript
define: {
  'process.env.HF_TOKEN': JSON.stringify(env.HF_TOKEN),
  'process.env.STABLE_DIFFUSION_KEY': JSON.stringify(env.STABLE_DIFFUSION_KEY),
  'process.env.REPLICATE_TOKEN': JSON.stringify(env.REPLICATE_TOKEN)
  // ...
}
```

### 2. `services/geminiService.ts`
A função antiga `generateImage` foi refatorada em uma **Arquitetura de Orquestração**:

*   **Funções Isoladas:** Criadas funções específicas para cada provedor (`generateImageGemini`, `generateImageHuggingFace`, etc.).
*   **Orquestrador:** A função principal `generateImage` agora atua como um gerenciador:
    ```typescript
    export const generateImage = async (prompt) => {
        // Tenta Gemini...
        if (sucesso) return url;
        
        // Falhou? Tenta Hugging Face...
        if (sucesso) return url;
        
        // ... e assim por diante
    }
    ```
*   **Tratamento de Erros:** Cada função isolada captura seus próprios erros e retorna `null` em vez de quebrar a aplicação, permitindo que o orquestrador continue.

---

## 🧪 Como Testar

1.  Adicione pelo menos uma chave extra (recomendo **Hugging Face**) no `.env`.
2.  Para forçar o teste do backup, você pode temporariamente "quebrar" a chave do Gemini no `.env` (ex: mude uma letra) ou comentar a chamada do Gemini no código.
3.  Observe o console do navegador (F12). Você verá logs como:
    *   `👉 Attempting: Gemini (Imagen 3)`
    *   `Error generating image with Gemini...`
    *   `👉 Attempting: Hugging Face`
    *   `✅ Image generated successfully!`
