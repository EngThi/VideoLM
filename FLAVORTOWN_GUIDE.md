# 🍔 Hack Club: Flavortown Guide

Este ambiente de desenvolvimento está configurado para participação no **Hack Club Flavortown** (Inverno 2024/2025).

## 🎯 O Objetivo: "Let Him Cook"
Flavortown é um evento focado em construir projetos pessoais **Open Source**.
- **Período:** 22 de Dezembro a 31 de Março.
- **Moeda:** Você ganha **Cookies** enviando projetos (shipping).
- **Recompensas:** Cookies podem ser trocados por prêmios reais (Hardware, Laptops, Equipamentos).

## ⏱️ Hackatime: O Rastreador de Tempo
Para que o trabalho seja contabilizado, utilizamos o **Hackatime** (uma versão do WakaTime para o Hack Club).

### O que ele faz?
Ele roda silenciosamente em background, monitorando o tempo ativo de digitação e uso do editor. Esses dados são enviados para o Hack Club para validar o esforço nos projetos.

### Configuração neste Ambiente (Project IDX)
Como este é um ambiente volátil (NixOS), o Hackatime precisa estar ativo.
O comando de instalação geralmente segue este formato (encontrado anteriormente em `coisas.txt`):

```bash
export HACKATIME_API_KEY="SUA_CHAVE_AQUI" 
export HACKATIME_API_URL="https://hackatime.hackclub.com/api/hackatime/v1" 
curl -sSL https://hackatime.hackclub.com/hackatime/setup.sh | bash
```

> **Nota:** Se o ambiente reiniciar e o plugin parar de funcionar, rode o comando novamente. Verifique se o arquivo `.wakatime.cfg` existe na home.

## 🤖 Contexto para Agentes de IA
Se você é uma IA (Gemini, Copilot, etc.) lendo isso para entender o contexto:
1.  **Foco em Open Source:** Todo código gerado deve ser limpo, bem documentado e licenciado (MIT/Apache).
2.  **Qualidade:** O objetivo é "shippar" um produto funcional. Priorize código que funciona em vez de teoria.
3.  **Projetos Atuais:**
    - **AI Video Factory (YouTubeVideoMaster):** Uma automação Full-stack (React + NestJS) para gerar vídeos.

## 🔗 Links Úteis
- **Dashboard do Hackatime:** [hackatime.hackclub.com](https://hackatime.hackclub.com)
- **High Seas / Flavortown Info:** [hackclub.com](https://hackclub.com)
