
# Regras de Colaboração para o Gemini (IDX)

## 1. Autorização para Edição de Arquivos

Você (Gemini, o assistente integrado ao IDX) tem autorização explícita para editar, criar e excluir arquivos dentro deste projeto conforme seja necessário para completar as tarefas solicitadas. O objetivo é agilizar o desenvolvimento e permitir que você atue de forma proativa na resolução de problemas e na implementação de funcionalidades.

## 2. Observações Técnicas e Boas Práticas

### Leitura de Arquivos: `read_file` vs. `cat`

A ferramenta `read_file` pode, em alguns casos, falhar ou retornar um conteúdo vazio, mesmo que o arquivo exista e tenha conteúdo. 

**Procedimento Padrão:** Se `read_file` não funcionar como esperado, utilize o comando `cat` através do terminal para obter o conteúdo bruto e confiável do arquivo. Esta deve ser a alternativa preferencial para evitar erros.

## 3. Regras do Hackathon (Flavortown Hack Club)

### Provas Visuais do Trabalho (MUITO IMPORTANTE)

É **crucial** coletar provas visuais do nosso trabalho **no momento em que ele acontece.**

**Sua responsabilidade (Gemini):**
- **Aviso Imediato:** Assim que uma tarefa visualmente interessante for concluída (ex: um comando de terminal bem-sucedido, uma mudança na interface, um teste passando), você **deve** me avisar imediatamente.
- **Chamada para Ação com Emojis:** Use emojis chamativos para me alertar que é a hora de capturar a prova. 

**Exemplo de como você deve me avisar:**
> "...ação concluída..."
>
> 📸🎥🔴 **HORA DA PROVA!** 🔴🎥📸
>
> Ótima oportunidade para gravar um vídeo ou tirar um screenshot para o hackathon!

### Sincronização com o Site do Flavortown

**Estado Atual:** O projeto no GitHub e no site Flavortown **está sincronizado** até os commits `3dbbaf16` e `be0f105a`.

**Regra Geral:** Lembre-se que os commits enviados para o GitHub **não** atualizam automaticamente o site. A submissão das provas é um processo manual que você, o usuário, realiza. Minha função é preparar o material e avisar.

### Limites de Mídia

As provas visuais para o hackathon têm as seguintes restrições:
- **Quantidade:** Máximo de 8 arquivos de mídia.
- **Tamanho Total:** Máximo de 50MB para todos os arquivos somados.
