# 🤖 GEMINI.md - Contexto e Guia do Projeto

> **Nota para a IA:** Leia este arquivo antes de iniciar qualquer tarefa complexa.

## 🎯 Objetivo do Projeto
**Nome:** YouTubeVideoMaster (Flavortown Edition)
**Meta:** Criar uma aplicação Full-stack que automatiza a criação de vídeos para YouTube usando IA.
**Contexto:** Hack Club Flavortown (Inverno 2025/2026).

## ⏳ Estratégia de "Farm" de Horas & Commits
> **IMPORTANTE:** Para maximizar a contagem de horas e atividade no Hackatime/GitHub:
1.  **Commits Incrementais:** Não faça um "mega commit" no final do dia. Envie pequenas alterações funcionais (ex: "ajustou cor do botão", "criou função X"). Isso mostra atividade constante.
2.  **DevLogs Diários:** Grave sessões de *coding* real. O script `~/devlog.sh` facilita isso.
3.  **Fluxo Contínuo:** Tente manter o editor ativo. O WakaTime para de contar se não houver digitação por 2 minutos.

## 🛠 Tech Stack
- **Frontend:** React + Vite + TypeScript (`/`)
- **Backend:** NestJS (`/server`)
- **Serviços:** FFmpeg, Google Gemini API, Asciinema.

## 🚨 Regras de Ouro
1.  **Hackatime:** Certifique-se de que está rodando (`curl ... setup.sh` se reiniciar).
2.  **Gravação:** `~/devlog.sh` antes de codar tarefas complexas.
3.  **Segurança:** NUNCA commite `.env`.

## 📍 Estado Atual
- [x] Setup Ambiente & Scripts (`devlog.sh`, `agg` instalado).
- [x] Repositório Git reiniciado e limpo.
- [x] Instalação de dependências.
- [x] Conectar Frontend ao Backend.
- [x] Implementar MVP (Geração de Roteiro)
- [x] Sistema de Rotação de Chaves de API (Gemini/HF/SD/Replicate).

## 📂 Estrutura & Arquivos Ignorados
- `devlogs/`: Vídeos locais (NÃO ENVIAR PARA O GITHUB).
- `node_modules/`: Dependências.
- `.env`: Segredos.

## 📝 Comandos
- **Gravar:** `~/devlog.sh`
- **Dev:** `npm run dev` (Front) / `npm run start:dev` (Back)

## 🏆 DIRETRIZES DE CONCURSO & POSTURA (CRÍTICO)

### 1. 📸 Coleta de Evidências (DevLog)
**Sempre que completarmos uma tarefa funcional ou visual:**
- **Exija Provas:** Me lembre explicitamente: *"Tire um print agora do [Recurso]"* ou *"Grave um clipe de 10s mostrando isso funcionando"*.
- **Contexto:** Isso é vital para o vídeo final do Hackathon. Sem provas, não há prêmio.

### 2. 👻 "Ghost Mode" (Postura de Trabalho)
**Ao fornecer código ou soluções:**
- **Zero Conversa Fiada:** Não diga "Eu fiz isso para você".
- **Código Pronto:** Entregue blocos de código completos e prontos para copiar/colar.
- **Narrativa de Autoria:** O texto deve soar técnico e direto. Use frases como *"A implementação no arquivo X fica assim:"*.
- **Objetivo:** Facilitar que eu copie o código e pareça que estou produzindo muito.
