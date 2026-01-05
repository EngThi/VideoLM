# 🗺️ YouTubeVideoMaster - Roadmap & Vision

Este documento rastreia a evolução do projeto, metas atingidas e o planejamento futuro para o Hack Club Flavortown.

## 📍 Onde Estamos (Estado Atual)

### 🚀 Core Pipeline (Finalizado)
- [x] **Scripting Inteligente:** Geração de roteiros via Gemini com embasamento em buscas reais do Google.
- [x] **Narração Nativa:** Integração com Gemini TTS para vozes naturais e controle de timing.
- [x] **Storyboard Orchestrator:** Sistema de geração de imagens com fallback em cascata (Gemini -> HF -> SD -> Pollinations).
- [x] **Ken Burns Engine:** Transformação de imagens estáticas em vídeo dinâmico via FFmpeg (Pan & Zoom).
- [x] **Burn-in Subtitles:** Legendas automáticas sincronizadas e estilizadas diretamente no vídeo.

### 🛠️ Developer Experience (DX)
- [x] **Dev Mode (ZIP):** Bypass completo de APIs para testes instantâneos usando assets locais.
- [x] **Atomic Verification:** Sistema de checagem de integridade de arquivos pós-renderização.
- [x] **API Rotation:** Gestão automática de múltiplas chaves de API para evitar rate-limits.

---

## 🏗️ O que vem a seguir (Backlog)

### 🟡 Fase 2: Refinamento & Qualidade (Em breve)
- [ ] **Automated Quality Gate (Stage 6):** Scripts de validação para verificar se o áudio e o vídeo estão perfeitamente sincronizados antes de liberar o download.
- [ ] **Background Music Mixer:** Interface para selecionar trilhas sonoras (Lo-Fi, Cinematic, Corporate) e mixagem inteligente no backend (ducking).
- [ ] **Progress Monitoring:** Websockets ou polling para mostrar a porcentagem exata da renderização do FFmpeg na UI.

### 🔵 Fase 3: Social & Viral (Futuro)
- [ ] **9:16 Auto-Format:** Exportação automática para YouTube Shorts / TikTok / Reels com crop inteligente.
- [ ] **YouTube API Integration (Stage 7):** Upload direto para o canal do usuário com preenchimento automático de Título, Descrição e Tags baseados no roteiro.
- [ ] **Thumbnail Generator:** Criação de capas chamativas usando os assets do storyboard + texto de impacto.

### 🟣 Fase 4: Avançado
- [ ] **Veo 2.0 Integration:** Substituir imagens estáticas por clipes de vídeo gerados por IA quando disponível.
- [ ] **Multi-language support:** Tradução automática do roteiro e narração para múltiplos idiomas com um clique.

---

## 📊 Métricas de Sucesso
- **Tempo de Produção:** Reduzir de 30 minutos (manual) para < 3 minutos (automático).
- **Estabilidade:** 0 falhas de montagem por falta de sincronia ou assets corrompidos.
- **Engajamento DX:** Ciclo de teste local inferior a 10 segundos.

---
*Ultima atualização: 05 de Janeiro de 2026*
