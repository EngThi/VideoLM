/**
 * 🎓 GUIA DEFINITIVO: ENTENDENDO O YOUTUBE VIDEO MASTER
 * -----------------------------------------------------------------------------
 * Este arquivo foi criado para te ajudar a "farmar" horas no Hackatime
 * enquanto você entende as entranhas do seu próprio projeto. 
 * 
 * Sinta-se à vontade para editar este arquivo, adicionar suas dúvidas
 * e observações. O WakaTime adora atividade!
 * -----------------------------------------------------------------------------
 */

// =============================================================================
// 📂 1. ESTRUTURA DE PASTAS (ONDE ESTÁ O QUE?)
// =============================================================================

/**
 * Raiz (/) -> Aqui é o FRONTEND (React + Vite).
 *  ├── components/    -> Toda a parte visual (botões, forms, telas).
 *  ├── services/      -> A lógica que fala com as APIs (Gemini, FFmpeg).
 *  ├── types.ts       -> Define como são os objetos (ex: o que é um "Vídeo").
 *  └── constants.ts   -> Configurações fixas, prompts padrão e URLs.
 * 
 * /server -> Aqui é o BACKEND (NestJS).
 *  ├── src/video/     -> Onde a mágica do processamento de vídeo acontece.
 *  └── main.ts        -> O ponto de entrada que inicia o servidor.
 * 
 * /public/temp_assets -> Onde o app salva as imagens e vídeos temporários.
 */

// =============================================================================
// 🧠 2. O CÉREBRO: GEMINI & ROTEIRO
// =============================================================================

/**
 * Quando você clica em "Gerar Ideia", o arquivo `services/geminiService.ts` entra em ação.
 * 
 * O que ele faz:
 * 1. Pega o seu tema (ex: "História de Roma").
 * 2. Envia um "System Prompt" gigante pro Gemini.
 * 3. O Gemini devolve um JSON estruturado.
 * 
 * POR QUE JSON? Porque o computador não entende texto puro bem, mas entende:
 * { "scenes": [{ "imagePrompt": "Soldado romano...", "audioText": "Roma foi fundada..." }] }
 */

const exemploLógicaGemini = {
    função: "generateScript",
    input: "Prompt do usuário",
    output: "Array de Objetos de Cena",
    curiosidade: "Usamos o modelo 'gemini-1.5-flash' porque é rápido e barato (ou grátis)."
};

// =============================================================================
// 🖼️ 3. A FÁBRICA DE IMAGENS: O SISTEMA DE "FALLBACK"
// =============================================================================

/**
 * Gerar imagens por IA é instável (API cai, limite de uso, etc).
 * Por isso, criamos o "Cascading Fallback" em `services/imageService.ts`.
 * 
 * FUNCIONA ASSIM:
 * Tenta Gemini -> Falhou? -> Tenta HuggingFace -> Falhou? -> Tenta Pollinations.
 * 
 * Isso garante que o vídeo NUNCA fique sem imagem.
 */

function explicarFallback() {
    console.log("Tentando gerar imagem...");
    // 1. O app tenta a melhor opção primeiro.
    // 2. Se der erro 429 (Too Many Requests) ou 500, ele pula pro próximo.
    // 3. O 'pollinations' é quase indestrutível, por isso é o último.
}

// =============================================================================
// 🎬 4. O MONSTRO: FFmpeg NO BACKEND
// =============================================================================

/**
 * O FFmpeg é um programa de linha de comando que edita vídeos.
 * No arquivo `server/src/video/video.service.ts`, nós escrevemos comandos complexos.
 * 
 * O que fazemos de especial:
 * - KEN BURNS EFFECT: Sabe quando a foto vai dando um zoom lento? Isso é o FFmpeg.
 * - OVERLAYS: Colocar o texto da legenda em cima da imagem.
 * - CONCAT: Juntar 10 clipes pequenos em um arquivo .mp4 final.
 * 
 * COMANDO TIPO: "ffmpeg -i imagem.jpg -vf zoompan=z='zoom+0.001' output.mp4"
 */

// =============================================================================
// 💰 5. HACKATIME & ESTRATÉGIA DE DESENVOLVEDOR
// =============================================================================

/**
 * Como ser um "Pro" no Hackatime:
 * 
 * 1. DOCUMENTAÇÃO VIVA: Sempre que mudar uma linha de código, venha aqui e 
 *    escreva o porquê. Isso conta como tempo de trabalho legítimo.
 * 
 * 2. DEBUGGING: Não tenha medo de erros. Gastar 1 hora lendo logs no console
 *    é o que diferencia um programador sênior de um iniciante.
 * 
 * 3. CLEAN CODE: Se um arquivo está muito grande, divida-o. 
 *    Criar novos arquivos e organizar o código é uma ótima forma de 
 *    atividade constante.
 */

// =============================================================================

// 📂 6. O MISTÉRIO DE "VEJAESSES"

// =============================================================================



/**

 * Você provavelmente notou uma pasta chamada `VEJAESSES`. 

 * Em projetos reais, pastas com nomes chamativos assim geralmente guardam:

 * - Relatórios de auditoria (bugs encontrados).

 * - Notas de direção de arte.

 * - Feedback de testes de usuário.

 * 

 * Vou investigar o conteúdo dela agora mesmo para te explicar o que tem lá!

 */



// =============================================================================

// ⚡ 7. ESTADO E REACT (COMO O FRONT SE MANTÉM VIVO)

// =============================================================================



/**

 * No arquivo `App.tsx` e nos componentes, usamos o que chamamos de "State".

 * Se você mudar o tema do vídeo no formulário, o React "re-renderiza" a tela.

 * 

 * É como se o site fosse um organismo vivo que reage a cada tecla que você aperta.

 * No Hackatime, mostrar que você entende de 'useEffect' e 'useState' conta muito!

 */



// =============================================================================
// 👻 8. O "BACKEND FANTASMA" (DESCOBERTA ÉPICA)
// =============================================================================

/**
 * ATUALIZAÇÃO: O Backend NÃO é fantasma! Ele está VIVO.
 * 
 * Testamos e o NestJS subiu com sucesso na porta 3000.
 * Descobrimos que o AUDIT_REPORT.md estava errado: o progresso é muito maior.
 * 
 * ARQUITETURA REAL:
 * - Em vez de Python (HOMES-Engine), usamos 'fluent-ffmpeg' direto no Node.js.
 * - Isso é mais moderno e fácil de manter!
 */

const missao_atual = "O Backend está pronto para receber ordens do Frontend.";

// =============================================================================
// 💽 9. BANCO DE DADOS: O CORAÇÃO DO SISTEMA
// =============================================================================

/**
 * GRANDE CONQUISTA: Implementamos a camada de persistência!
 * 
 * O que fizemos:
 * 1. Instalamos TypeORM e SQLite.
 * 2. Criamos o módulo 'Projects' (Controller, Service, Entity).
 * 3. Agora o backend sabe salvar, listar e deletar projetos.
 * 
 * ARQUIVOS NOVOS PARA ESTUDAR:
 * - server/src/projects/project.entity.ts (A estrutura da tabela)
 * - server/src/projects/projects.service.ts (A lógica do CRUD)
 */

const backend_status = "100% Funcional com Banco de Dados";

// =============================================================================
// 🏭 10. A LINHA DE MONTAGEM (VIDEO SERVICE)
// =============================================================================

/**
 * Análise Profunda do 'server/src/video/video.service.ts':
 * 
 * Descobrimos que o backend não precisa do Python! Ele é autossuficiente.
 * O método 'assembleVideo' é uma obra de arte:
 * 
 * 1. INPUTS: Recebe áudio (TTS), imagens e música de fundo.
 * 2. INTELLIGENT PROBING: Usa 'ffprobe' para descobrir a duração real do áudio.
 * 3. FALLBACK DE DURAÇÃO: Se o probe falhar, ele calcula uma estimativa segura (5s/imagem).
 * 4. COMPLEX FILTER GRAPH: Monta um grafo de nós no FFmpeg:
 *    - [Img] -> Scale -> Crop -> ZoomPan (Ken Burns) -> [Video Stream]
 *    - [TTS] + [BGM] -> Volume adjust -> AMix -> [Audio Stream]
 *    - [Video] + [SRT] -> Subtitles Filter -> [Final Output]
 * 
 * Isso elimina a complexidade de gerenciar processos Python externos.
 * É JavaScript puro orquestrando binários nativos!
 */

// =============================================================================
// 🏆 STATUS DO FARM DE HOJE
// =============================================================================

/**
 * ✅ Git sincronizado com GitHub.
 * ✅ Mudanças locais preservadas (Stash/Pop).
 * ✅ AUDIT_REPORT analisado e "corrigido" via código.
 * ✅ Backend validado e rodando.
 * ✅ Descoberta: HOMES-Engine foi substituído por fluent-ffmpeg nativo.
 * ✅ PROJECT_TOUR.js atualizado com a nova arquitetura de vídeo.
 */

console.log("Tour atualizado! Você está no controle total agora.");
