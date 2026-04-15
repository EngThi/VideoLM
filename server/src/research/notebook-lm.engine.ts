import { execSync } from 'child_process';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotebookLMEngine {
  private readonly logger = new Logger(NotebookLMEngine.name);
  private nlmPath = '/home/user/.local/bin/uvx --from notebooklm-mcp-cli nlm';

  /**
   * Executa comandos CLI no motor NotebookLM em Python
   */
  private execute(command: string): string {
    try {
      const fullCommand = `${this.nlmPath} ${command}`;
      return execSync(fullCommand, { encoding: 'utf-8' });
    } catch (error) {
      this.logger.error(`Erro ao executar comando NotebookLM: ${command}`);
      throw error;
    }
  }

  async listNotebooks() {
    return this.execute('list');
  }

  async createAudioOverview(notebookId: string) {
    this.logger.log(`Solicitando Audio Overview para: ${notebookId}`);
    return this.execute(`audio create ${notebookId} --confirm`);
  }

  async createVideoOverview(notebookId: string, style: string = 'classic') {
    this.logger.log(`Solicitando Video Overview (${style}) para: ${notebookId}`);
    return this.execute(`video create ${notebookId} --style ${style} --confirm`);
  }
}
