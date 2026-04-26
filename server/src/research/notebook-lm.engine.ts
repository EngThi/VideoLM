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
    const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match) {
        this.logger.warn("ID não encontrado no output direto, tentando buscar via lista...");
        return "new-notebook-check-list"; 
    }
    return match[0];
  }

  async addSource(notebookId: string, url: string) {
    this.logger.log(`Adicionando fonte ao notebook ${notebookId}: ${url}`);
    return this.execute(`add url ${notebookId} "${url}"`);
  }

  async researchStart(notebookId: string, query: string) {
    this.logger.log(`Iniciando deep web factual research para: ${notebookId} (Busca: ${query})`);
    return this.execute(`research start "${query}" --notebook-id ${notebookId} --auto-import --confirm`);
  }

  async createAudioOverview(notebookId: string) {
    this.logger.log(`Solicitando Audio Overview para: ${notebookId}`);
    return this.execute(`create audio ${notebookId} --confirm`);
  }

  async createVideoOverview(notebookId: string, style: string = 'classic') {
    this.logger.log(`Solicitando Video Overview (${style}) para: ${notebookId}`);
    return this.execute(`create video ${notebookId} --style ${style} --confirm`);
  }

  async createInfographic(notebookId: string, style: string = 'professional', orientation: string = 'portrait') {
    this.logger.log(`Solicitando Infográfico (${style}, ${orientation}) para: ${notebookId}`);
    return this.execute(`create infographic ${notebookId} --style ${style} --orientation ${orientation} --confirm`);
  }

  async downloadAudio(notebookId: string, outputPath: string) {
    this.logger.log(`Baixando áudio do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download audio ${notebookId} --output "${outputPath}" --no-progress`);
  }

  async downloadVideo(notebookId: string, outputPath: string) {
    this.logger.log(`Baixando vídeo do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download video ${notebookId} --output "${outputPath}" --no-progress`);
  }

  async downloadInfographic(notebookId: string, outputPath: string) {
    this.logger.log(`Baixando infográfico do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download infographic ${notebookId} --output "${outputPath}" --no-progress`);
  }

  async checkStatus(notebookId: string) {
    return this.execute(`status artifacts ${notebookId} --json`);
  }
}
