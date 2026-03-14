# 🎓 Guia de Sobrevivência: Python vs TypeScript (Para o Hack Club)

Mano, respira. Você sabe lógica, só precisa aprender a sintaxe nova. O projeto usa **TypeScript (TS)**, que é basicamente Javascript com "regras de etiqueta" (tipagem).

---

## 1. Dicionário Rápido (Python 🐍 -> TypeScript 🦕)

| Conceito | Python 🐍 | TypeScript 🦕 | Explicação |
| :--- | :--- | :--- | :--- |
| **Variável** | `nome = "João"` | `const nome = "João";` | `const` é fixo, `let` pode mudar. Ponto e vírgula `;` é boa prática. |
| **Tipagem** | (Automática) | `const idade: number = 20;` | No TS, a gente avisa o tipo (number, string, boolean) pro código não quebrar depois. |
| **Função** | `def soma(a, b):`<br>`  return a + b` | `function soma(a: number, b: number) {`<br>`  return a + b;`<br>`}` | Sai `def`, entra `function`. Indentação vira `{ chaves }`. |
| **Dicionário**| `user = {"id": 1}` | `const user = { id: 1 };` | Quase igual. Chamamos de "Objeto" em JS/TS. |
| **Print** | `print("Olá")` | `console.log("Olá");` | O clássico debug. |
| **Importar** | `import os` | `import * as fs from 'fs';` | A lógica é a mesma, trazer ferramentas de outros arquivos. |

---

## 2. Entendendo um Arquivo Real do Projeto

Vamos ler o arquivo `server/src/ai/ai.controller.ts`. Ele é a "porta de entrada" quando o Frontend pede um roteiro.

**Código Real (com comentários traduzidos):**

```typescript
// 1. Imports: Igual no Python. Trazendo ferramentas do NestJS (o framework que usamos)
import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

// 2. Decorator (@): Igualzinho ao @app.route do Flask/Python.
// Diz: "Tudo que estiver aqui dentro responde em /api/ai"
@Controller('ai')
export class AiController {

  // 3. Construtor: É o __init__ do Python.
  // Aqui a gente pede: "Eu preciso do AiService para funcionar".
  // O NestJS entrega ele pronto (Injeção de Dependência).
  constructor(private readonly aiService: AiService) {}

  // 4. Rota: Quando alguém mandar um POST para /api/ai/script
  @Post('script')
  // 5. Async: "Espera a IA responder antes de continuar".
  // body: É o JSON que veio do Frontend (ex: { "prompt": "Video sobre gatos" })
  async generateScript(@Body() body: { prompt: string }) {
    
    // 6. Chamada: "Ei, AiService, pega esse prompt e faz a mágica."
    return this.aiService.generateScript(body.prompt);
  }
}
```

**Resumo da Ópera:**
O `Controller` é só o recepcionista. Ele recebe o JSON, passa para o `Service` (o especialista que realmente fala com a IA) e devolve a resposta.

---

## 3. Como explicar o projeto na entrevista? (O "Flow")

Se perguntarem: *"Como funciona a arquitetura?"*, você não precisa mostrar código linha a linha. Descreva o fluxo de dados:

1.  **O Input:** "O usuário digita o tema no Frontend (React). Isso vira uma requisição HTTP POST enviada pro Backend."
2.  **O Processamento (NestJS):** "O Backend recebe isso. Eu usei um padrão de **Controller/Service**:
    *   O **Controller** valida a entrada.
    *   O **Service** chama a API do Google Gemini para gerar o roteiro e os prompts de imagem."
3.  **A Renderização (FFmpeg):** "Depois que temos texto e imagens, eu uso o **FFmpeg** dentro de um container Docker para 'costurar' tudo num vídeo MP4, aplicando filtros de zoom (Ken Burns) e legendas."
4.  **A Entrega:** "O vídeo final é salvo numa pasta pública e devolvido para o usuário."

**Dica de Ouro:** Se perguntarem algo que você não sabe (ex: "Como funciona o Garbage Collection do Node?"), seja honesto: *"Eu foquei na arquitetura de microsserviços e na integração com IA, não cheguei a mexer a fundo na engine do Node nesse projeto."*
