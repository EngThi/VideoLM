import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KeyManagerService {
  private keys: string[];
  private currentIndex: number = 0;
  private readonly logger = new Logger(KeyManagerService.name);

  constructor(keysString: string, private readonly serviceName: string = 'Service') {
    this.keys = keysString.split(',').map(k => k.trim()).filter(k => k);
    this.logger.log(`Initialized with ${this.keys.length} keys for ${this.serviceName}`);
  }

  getCurrentKey(): string {
    return this.keys[this.currentIndex] || '';
  }

  rotate(): boolean {
    if (this.keys.length <= 1) {
      this.logger.warn(`Cannot rotate keys for ${this.serviceName} - only 1 key available.`);
      return false;
    }
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.logger.log(`Rotated key for ${this.serviceName}. Using key index: ${this.currentIndex}`);
    return true;
  }

  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  getAvailableKeyCount(): number {
    return this.keys.length;
  }
}
