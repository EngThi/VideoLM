import { execSync } from 'child_process';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

@Injectable()
export class NotebookLMEngine {
  private readonly logger = new Logger(NotebookLMEngine.name);
  private nlmPath = process.env.NLM_COMMAND || 'uvx --from notebooklm-mcp-cli@0.5.28 nlm';
  private nlmHome = process.env.NLM_HOME || path.join(os.homedir(), '.notebooklm-mcp-cli');

  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private safeProfile(profile?: string): string | undefined {
    if (!profile) return undefined;
    const normalized = profile.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
    return normalized || undefined;
  }

  private profileFlag(profile?: string): string {
    const safe = this.safeProfile(profile);
    return safe ? ` --profile ${this.shellQuote(safe)}` : '';
  }

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

  listProfiles() {
    const profilesDir = path.join(this.nlmHome, 'profiles');
    if (!fs.existsSync(profilesDir)) return [];

    return fs.readdirSync(profilesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const metadataPath = path.join(profilesDir, entry.name, 'metadata.json');
        let metadata: any = {};
        if (fs.existsSync(metadataPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          } catch {
            metadata = {};
          }
        }

        return {
          id: entry.name,
          email: metadata.email || metadata.account_email || null,
          hasCookies: fs.existsSync(path.join(profilesDir, entry.name, 'cookies.json')),
        };
      });
  }

  saveCookiesProfile(profile: string, cookies: unknown) {
    const safe = this.safeProfile(profile);
    if (!safe) throw new Error('Invalid profile id.');

    if (!Array.isArray(cookies) && (!cookies || typeof cookies !== 'object')) {
      throw new Error('cookies.json must be a JSON object or array.');
    }

    const profileDir = path.join(this.nlmHome, 'profiles', safe);
    fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(profileDir, 'cookies.json'), JSON.stringify(cookies, null, 2), { mode: 0o600 });
    fs.writeFileSync(
      path.join(profileDir, 'metadata.json'),
      JSON.stringify({ importedAt: new Date().toISOString(), source: 'videolm-upload' }, null, 2),
      { mode: 0o600 },
    );

    return { id: safe, hasCookies: true };
  }

  async listNotebooks(profile?: string) {
    return this.execute(`notebook list --json${this.profileFlag(profile)}`);
  }

  async listSources(notebookId: string, profile?: string) {
    return this.execute(`source list ${this.shellQuote(notebookId)} --json${this.profileFlag(profile)}`);
  }

  async createNotebook(title: string, profile?: string): Promise<string> {
    this.logger.log(`Criando novo notebook: ${title}`);
    const output = this.execute(`create notebook ${this.shellQuote(title)}${this.profileFlag(profile)}`);
    const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match) {
        this.logger.warn("ID não encontrado no output direto, tentando buscar via lista...");
        return "new-notebook-check-list"; 
    }
    return match[0];
  }

  async addSource(notebookId: string, url: string, profile?: string) {
    this.logger.log(`Adicionando fonte ao notebook ${notebookId}: ${url}`);
    return this.execute(`source add ${this.shellQuote(notebookId)} --url ${this.shellQuote(url)} --wait${this.profileFlag(profile)}`);
  }

  async addFileSource(notebookId: string, filePath: string, profile?: string) {
    this.logger.log(`Adicionando arquivo ao notebook ${notebookId}: ${filePath}`);
    return this.execute(`source add ${this.shellQuote(notebookId)} --file ${this.shellQuote(filePath)} --wait${this.profileFlag(profile)}`);
  }

  async researchStart(notebookId: string, query: string, profile?: string) {
    this.logger.log(`Iniciando deep web factual research para: ${notebookId} (Busca: ${query})`);
    return this.execute(`research start ${this.shellQuote(query)} --notebook-id ${this.shellQuote(notebookId)} --auto-import${this.profileFlag(profile)}`);
  }

  async createAudioOverview(notebookId: string, profile?: string) {
    this.logger.log(`Solicitando Audio Overview para: ${notebookId}`);
    return this.execute(`create audio ${this.shellQuote(notebookId)} --confirm${this.profileFlag(profile)}`);
  }

  async createVideoOverview(notebookId: string, style: string = 'classic', profile?: string, stylePrompt?: string) {
    this.logger.log(`Solicitando Video Overview (${style}) para: ${notebookId}`);
    const promptFlag = stylePrompt ? ` --style-prompt ${this.shellQuote(stylePrompt)}` : '';
    return this.execute(`create video ${this.shellQuote(notebookId)} --style ${this.shellQuote(style)}${promptFlag} --confirm${this.profileFlag(profile)}`);
  }

  async createInfographic(notebookId: string, style: string = 'professional', orientation: string = 'portrait', profile?: string) {
    this.logger.log(`Solicitando Infográfico (${style}, ${orientation}) para: ${notebookId}`);
    return this.execute(`create infographic ${this.shellQuote(notebookId)} --style ${this.shellQuote(style)} --orientation ${this.shellQuote(orientation)} --confirm${this.profileFlag(profile)}`);
  }

  async createReport(notebookId: string) {
    this.logger.log(`Gerando Report factual para: ${notebookId}`);
    return this.execute(`create report ${notebookId} --confirm`);
  }

  async downloadAudio(notebookId: string, outputPath: string, profile?: string) {
    this.logger.log(`Baixando áudio do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download audio ${this.shellQuote(notebookId)} --output ${this.shellQuote(outputPath)} --no-progress`);
  }

  async downloadVideo(notebookId: string, outputPath: string, profile?: string) {
    this.logger.log(`Baixando vídeo do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download video ${this.shellQuote(notebookId)} --output ${this.shellQuote(outputPath)} --no-progress`);
  }

  async downloadInfographic(notebookId: string, outputPath: string, profile?: string) {
    this.logger.log(`Baixando infográfico do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download infographic ${this.shellQuote(notebookId)} --output ${this.shellQuote(outputPath)} --no-progress`);
  }

  async downloadReport(notebookId: string, outputPath: string) {
    this.logger.log(`Baixando Report Markdown do notebook ${notebookId} para: ${outputPath}`);
    return this.execute(`download report ${notebookId} --output "${outputPath}"`);
  }

  async checkStatus(notebookId: string, profile?: string) {
    return this.execute(`status artifacts ${this.shellQuote(notebookId)} --json${this.profileFlag(profile)}`);
  }
}
