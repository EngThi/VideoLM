# YouTubeVideoMaster (Flavortown Edition)

Plataforma full-stack para automação de criação de vídeos para YouTube, integrando IA multimodal e pesquisa factual profunda. O sistema utiliza uma arquitetura híbrida para orquestrar roteirização, geração de ativos e montagem audiovisual.

## 🏗 Arquitetura do Sistema

O projeto é dividido em três camadas principais:

1.  **Frontend (React + Vite):** Interface SPA para gerenciamento de projetos, acompanhamento de status em tempo real e visualização de storyboards.
2.  **Backend (NestJS):** Core API responsável pela gestão de usuários, persistência em SQLite, proteção de rotas via JWT e orquestração do pipeline.
3.  **Research Engine (Python/MCP):** Motor de pesquisa profunda baseado no NotebookLM (via `nlm-mcp-cli`), permitindo a ingestão de fontes externas (URLs/PDFs) para geração de Audio e Video Overviews.

## 🚀 Funcionalidades Principais

-   **Pipeline Multimodal (Gemini 2.5 Flash):** Geração sincronizada de roteiro, narração (TTS) e imagens 16:9 em um único fluxo.
-   **Modo Research:** Integração programática com o Google NotebookLM para criar conteúdo baseado em fontes factuais.
-   **Immortal Background Renderer:** Sistema de assembly de vídeo via FFmpeg que roda em workers de segundo plano com suporte a polling de status.
-   **Hardened Infrastructure:** Suporte a payloads de até 100MB e limites de multipart otimizados para processamento de assets em lote.

## 🔐 Segurança e Identidade

-   **Autenticação:** Fluxo completo de Registro/Login utilizando JWT (JSON Web Tokens).
-   **Proteção de Rotas:** Guards implementados em nível de controlador para proteger endpoints de IA e Pesquisa.
-   **Isolamento de Dados:** Consultas ao banco de dados filtradas por `userId`, garantindo a privacidade dos projetos entre usuários.

## 🛠 Configuração e Instalação

### Requisitos
-   Node.js 20+
-   Python 3.10+ (com gerenciador `uv`)
-   FFmpeg

### Instalação do Backend
```bash
cd server
npm install
npm run build
```

### Instalação do Motor de Pesquisa
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uvx --from notebooklm-mcp-cli nlm login --manual
```

### Variáveis de Ambiente (.env.local)
```env
DATABASE_PATH=../data/database.sqlite
GEMINI_API_KEY=sua_chave_aqui
HF_TOKEN=seu_token_huggingface
JWT_SECRET=seu_segredo_jwt
```

## 🚦 Verificação de Sistema
Para validar a integridade da comunicação entre os motores, utilize os scripts de teste incluídos:
-   `npm run test:nlm`: Valida a ponte com o NotebookLM.
-   `npm run test:gemini`: Valida a rotação de chaves e geração multimodal.

---
**Status:** Fase 2 (SaaS Foundation) Completa.
