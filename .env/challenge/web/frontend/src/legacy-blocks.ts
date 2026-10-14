import {inject, Injectable} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

export interface WorkspaceBlock {
  kind: string;
  body?: string;
  packet?: string;
}

interface ArchivedBlock {
  version: string;
  markup: string;
  integrity: string;
}

@Injectable({providedIn: 'root'})
export class LegacyBlocks {
  private readonly sanitizer = inject(DomSanitizer);

  render(block: WorkspaceBlock): string | SafeHtml {
    if (block.kind !== 'archive' || typeof block.packet !== 'string') {
      return block.body || '';
    }

    try {
      const bytes = Uint8Array.from(atob(block.packet), (value) => value.charCodeAt(0));
      const archived = JSON.parse(new TextDecoder().decode(bytes)) as ArchivedBlock;
      if (archived.version !== 'canvas-1') return '';
      if (archived.integrity !== this.checksum(archived.markup)) return '';
      return this.sanitizer.bypassSecurityTrustHtml(archived.markup);
    } catch {
      return '';
    }
  }

  private checksum(value: string): string {
    let state = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(value)) {
      state = Math.imul(state ^ byte, 0x01000193) >>> 0;
    }
    return state.toString(16).padStart(8, '0');
  }
}

