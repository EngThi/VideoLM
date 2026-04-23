# 🚚 Guia de Migração: Como Rodar o VideoLM em Qualquer Lugar

Se o ambiente atual estiver travando, siga estes passos para mover a "Fábrica" para um novo local (Local ou VM).

## 📦 Opção 1: Via Docker (Recomendado para VM)

Esta é a forma mais estável de manter o projeto ligado 24/7.

1.  **Clone o Repo:** `git clone <url-do-seu-repo>`
2.  **Configure o .env:**
    *   `cp .env.example .env`
    *   Preencha suas chaves do Gemini e HuggingFace.
3.  **Prepare a Sessão do NotebookLM:**
    *   Crie a pasta `~/.notebooklm-mcp-cli/profiles/default/` no novo servidor.
    *   Copie os arquivos `cookies.json` e `metadata.json` da pasta `nlm/` do projeto para dentro dessa pasta. **Sem isso, a pesquisa profunda não funciona.**
4.  **Suba a Fábrica:**
    ```bash
    docker-compose up -d --build
    ```
    *O projeto estará disponível no IP da sua VM na porta 3001.*

## 💻 Opção 2: Rodando Manualmente (Local/Dev)

Se você for rodar no seu computador (Mac/Linux/Windows WSL):

### 1. Requisitos
-   **Node.js 20+**
-   **FFmpeg** (Instale via `brew install ffmpeg` ou `sudo apt install ffmpeg`)
-   **Python 3.10+**
-   **UV (Astral):** `curl -LsSf https://astral.sh/uv/install.sh | sh`

### 2. Setup do Backend
```bash
cd server
npm install
npm run build
# Configure o .env dentro da pasta server também
npm run start:prod
```

### 3. Setup do Frontend
```bash
cd ..
npm install
npm run dev
```

## ⚠️ Lembrete Crítico: Os Cookies
O NotebookLM não tem API oficial. O nosso sistema "sequestra" a sua sessão do navegador. Sempre que você mudar de computador, você precisa garantir que o arquivo `nlm/cookies.json` esteja atualizado com uma sessão ativa do Google.

---
**Dica para a VM:** Use o `pm2` ou o próprio `docker-compose` com `restart: always` para garantir que o projeto não morra se a VM reiniciar.
