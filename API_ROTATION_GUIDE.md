# 🔄 Guia do Sistema de Rotação de APIs (Atualizado)

Este projeto implementa um sistema robusto de **Rotação de Chaves de API** e **Fallback de Provedores**.
O objetivo é garantir resiliência total contra limites de cota (Erro 429), bloqueios temporários ou falhas de serviço.

---

## 🔑 1. Rotação de Chaves de API (Multi-Key)

Agora você pode definir **múltiplas chaves** para o mesmo provedor. Se a chave principal atingir o limite (Quota Exceeded), o sistema trocará automaticamente para a próxima chave disponível e tentará novamente a operação, de forma transparente para o usuário.

### Configuração no `.env`

Existem duas formas de configurar múltiplas chaves:

#### Método A: Lista separada por vírgulas (Recomendado para simplicidade)
```env
# Gemini (Separadas por vírgula)
GEMINI_API_KEY="chave_1,chave_2,chave_3"

# Hugging Face
HF_TOKEN="token_1,token_2"
```

#### Método B: Variáveis Indexadas (Melhor para organização)
O sistema detecta automaticamente variáveis com o mesmo prefixo.
```env
# Principal
GEMINI_API_KEY=chave_principal

# Backups
GEMINI_API_KEY_2=chave_reserva_1
GEMINI_API_KEY_3=chave_reserva_2

# O mesmo vale para outros serviços:
HF_TOKEN=token_principal
HF_TOKEN_SECONDARY=token_reserva
```

### Provedores Suportados para Rotação de Chaves
- **Google Gemini** (Geração de Texto, Script, Audio, Vídeo, Imagens)
- **Hugging Face** (Imagens)
- **Stable Diffusion API** (Imagens)
- **Replicate** (Imagens)

---

## 🛡️ 2. Fallback de Provedores de Imagem

Se todas as chaves de um provedor falharem, o sistema passa para o próximo provedor da lista (Orquestração).

**Ordem de Prioridade:**
1.  🥇 **Gemini (Imagen 3)** - *Alta Qualidade / Nativo*
2.  🥈 **Hugging Face** (SDXL) - *Rápido / Gratuito*
3.  🥉 **Stable Diffusion API** - *Backup*
4.  ⚔️ **Pollinations.AI** - *Sem chave necessária*
5.  💎 **Replicate** (Flux) - *Premium*
6.  🎨 **Craiyon** - *Último recurso*

---

## 🛠 Detalhes Técnicos

### Backend/Frontend (Vite)
O arquivo `vite.config.ts` foi configurado para agregar automaticamente todas as variáveis de ambiente que começam com `GEMINI_API_KEY`, `HF_TOKEN`, etc., e expô-las ao frontend como arrays.

### Lógica de Retry
As funções de serviço (`geminiService.ts`, `imageService.ts`) agora possuem wrappers (`withGeminiRetry`, `KeyManager`) que:
1.  Interceptam erros.
2.  Verificam se é um erro de cota (`429`, `Quota exceeded`).
3.  Se for, rotacionam a chave interna.
4.  Re-executam a requisição.
5.  Se todas as chaves falharem, lançam o erro para o orquestrador tentar o próximo provedor.