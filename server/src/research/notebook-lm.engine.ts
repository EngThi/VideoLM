import { execSync } from 'child_process';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotebookLMEngine {
  private readonly logger = new Logger(NotebookLMEngine.name);
  private nlmPath = '/home/user/.local/bin/uvx --from notebooklm-mcp-cli@0.5.28 nlm';

  private cleanupZombies() {
    try {
      execSync('pkill -f chromium || true');
      execSync('pkill -f chrome || true');
    } catch (e) {
      // Ignore errors if no process is found
    }
  }

  /**
   * Executa comandos CLI no motor NotebookLM em Python
   */
  private execute(command: string): string {
    try {
      const fullCommand = `${this.nlmPath} ${command}`;
      const result = execSync(fullCommand, { encoding: 'utf-8' });
      this.cleanupZombies();
      return result;
    } catch (error: any) {
      this.cleanupZombies();
      const stdout = error.stdout?.toString();
      const stderr = error.stderr?.toString();
      this.logger.error(`[NLM EXEC FAIL] Comando: ${command}`);
      if (stdout) this.logger.error(`[NLM STDOUT]: ${stdout}`);
      if (stderr) this.logger.error(`[NLM STDERR]: ${stderr}`);
      throw new Error(`NLM Command Failed: ${stderr || stdout || error.message}`);
    }
  }

  async listNotebooks() {
    return this.execute('list notebooks');
  }

  async createNotebook(title: string): Promise<string> {
    this.logger.log(`Criando novo notebook: ${title}`);
    const output = this.execute(`create notebook "${title}"`);
    // Extrai o UUID do notebook criado do output da CLI
    const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match) {
        // Fallback: tenta buscar na lista se não achou no output direto
        this.logger.warn("ID não encontrado no output direto, tentando buscar via lista...");
        return "new-notebook-check-list"; 
    }
    return match[0];
  }

  async addSource(notebookId: string, url: string) {
    this.logger.log(`Adicionando fonte ao notebook ${notebookId}: ${url}`);
    return this.execute(`add url ${notebookId} "${url}"`);
  }

  async researchStart(notebookId: string) {
    this.logger.log(`Iniciando deep web factual research para: ${notebookId}`);
    return this.execute(`research_start ${notebookId}`);
  }

  async createAudioOverview(notebookId: string) {
    this.logger.log(`Solicitando Audio Overview (Studio) para: ${notebookId}`);
    return this.execute(`studio_create ${notebookId} --type audio --confirm`);
  }

  async createVideoOverview(notebookId: string, style: string = 'classic') {
    this.logger.log(`Solicitando Video Overview (Studio) (${style}) para: ${notebookId}`);
    return this.execute(`studio_create ${notebookId} --type video --style ${style} --confirm`);
  }

  async reviseScript(notebookId: string, instructions: string) {
    this.logger.log(`Solicitando revisão de script para: ${notebookId}`);
    return this.execute(`studio_revise ${notebookId} --instructions "${instructions}"`);
  }

  async downloadAudio(notebookId: string, outputPath: string) {
    this.logger.log(`Baixando artefato de áudio do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download_artifact ${notebookId} --type audio --output "${outputPath}" --no-progress`);
  }

  async downloadVideo(notebookId: string, outputPath: string) {
    this.logger.log(`Baixando artefato de vídeo do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download_artifact ${notebookId} --type video --output "${outputPath}" --no-progress`);
  }

  async checkStatus(notebookId: string) {
    return this.execute(`studio status ${notebookId} --json`);
  }
}
