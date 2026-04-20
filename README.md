# 🎥 YouTubeVideoMaster (VideoLM)

> **A ponte definitiva entre a pesquisa profunda e o audiovisual autônomo.** 🧠🚀

Este projeto nasceu de uma necessidade real: **transformar o caos de informações da internet em vídeos educativos de alta qualidade.** Não é apenas um "gerador de vídeo", é um orquestrador que utiliza o poder do **NotebookLM** para estudar e o **Gemini 2.5** para visualizar.

## ✨ Por que este projeto é útil?

Estudantes, pesquisadores e criadores de conteúdo gastam horas transformando PDFs e links em roteiros. O **VideoLM** automatiza esse ciclo:
1.  **Ingestão:** Você fornece as fontes (URLs ou PDFs).
2.  **Pesquisa:** O motor Python (NLP) cria um "Cérebro" no Google NotebookLM e gera um Deep Dive factual.
3.  **Visão:** O Gemini 2.5 projeta um Storyboard Cinematográfico baseado nos fatos.
4.  **Produção:** O motor FFmpeg monta o vídeo final com movimentos de câmera e áudio de alta fidelidade.

## 🏗 Arquitetura Híbrida (The Tech Sauce)

Para atingir esse nível de precisão, o projeto utiliza uma arquitetura única:
-   **Backend NestJS (Node.js):** Gerencia a orquestração, segurança (JWT) e o pipeline de renderização.
-   **Research Engine (Python/MCP):** Interface programática com o Google Studio, permitindo automação de ferramentas que normalmente exigem interação humana.
-   **Frontend React + Vite:** Interface minimalista focada em produtividade e acompanhamento de progresso em tempo real.

## 🚀 Como a Comunidade pode usar?

O projeto é **100% Open Source**. Você pode rodar sua própria fábrica de vídeos localmente ou em uma VM:

### Setup Rápido (Docker)
```bash
docker-compose up -d
```

### Setup Manual (Dev Mode)
1. **Backend:** `cd server && npm install && npm run start:dev`
2. **Research:** `uvx --from notebooklm-mcp-cli nlm login --manual`
3. **Frontend:** `npm install && npm run dev`

## 🛠 Contribua!
O VideoLM é feito pela galera para a galera. Quer adicionar suporte a auto-upload no YouTube? Ou novas vozes de IA? Veja nosso `CONTRIBUTING.md` e junte-se ao time do Flavortown!

---
**Ship Target:** 25 de Abril | **Current Status:** Motor 100% Funcional.
