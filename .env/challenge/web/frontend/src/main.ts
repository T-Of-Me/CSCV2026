import {CommonModule} from '@angular/common';
import {HttpClient, provideHttpClient, withFetch} from '@angular/common/http';
import {Component, inject, signal} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {ActivatedRoute, RouterLink, RouterOutlet, provideRouter} from '@angular/router';
import {LegacyBlocks, WorkspaceBlock} from './legacy-blocks';

interface WorkspaceManifest {
  name: string;
  owner?: string;
  blocks: WorkspaceBlock[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="app-shell">
      <header class="topbar">
        <a routerLink="/" class="brand" aria-label="Chromatic home">
          <span class="brand-mark"><i></i><i></i><i></i></span>
          <span>chromatic</span>
        </a>
        <div class="topbar-status"><span class="pulse-dot"></span> studio / 03.4</div>
      </header>

      <section class="hero panel">
        <div class="hero-copy">
          <p class="eyebrow"><span>COLLABORATIVE CANVAS</span><b>01</b></p>
          <h1>Make room for<br><em>good ideas.</em></h1>
          <p class="lede">A focused space for visual research, references, and unfinished thoughts worth returning to.</p>
          <div class="hero-footer">
            <a class="button button-primary" href="#tools">Enter the studio <span>↘</span></a>
            <span class="hero-caption">Private by default<br>Built for small teams</span>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-orbit orbit-one"></div>
          <div class="art-orbit orbit-two"></div>
          <div class="art-core"><span>◎</span></div>
          <span class="art-label label-top">FIELD NOTES / 24</span>
          <span class="art-label label-bottom">SYNC READY</span>
        </div>
      </section>

      <section class="stats-row" aria-label="Studio details">
        <div><strong>01</strong><span>workspace<br>at a time</span></div>
        <div><strong>∞</strong><span>ideas in<br>progress</span></div>
        <div><strong>24</strong><span>character<br>workspace key</span></div>
      </section>

      <section id="tools" class="tools-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow"><span>YOUR WORKBENCH</span><b>02</b></p>
            <h2>Start somewhere.</h2>
          </div>
          <p class="section-note">Three small actions to get a board moving.</p>
        </div>

        <div class="tool-grid">
          <article class="tool-card panel">
            <div class="card-top"><span class="card-number">01</span><span class="card-icon">＋</span></div>
            <h3>Add a reference</h3>
            <p class="card-copy">Bring one visual cue into the room. We accept PNG, JPEG, GIF, WebP, BMP, and SVG.</p>
            <label class="file-drop">
              <input #image type="file" accept="image/*">
              <span class="file-glyph">↥</span>
              <span><strong>{{ image.files?.[0]?.name || 'Choose an image' }}</strong><small>or drop it here</small></span>
            </label>
            <button class="button button-secondary" [disabled]="uploadBusy()" (click)="upload(image.files?.[0])">
              {{ uploadBusy() ? 'Uploading…' : 'Upload reference' }} <span>↗</span>
            </button>
            @if (uploadResult()) { <pre class="status-block">{{ uploadResult() }}</pre> }
          </article>

          <article class="tool-card panel">
            <div class="card-top"><span class="card-number">02</span><span class="card-icon">↗</span></div>
            <h3>Open a workspace</h3>
            <p class="card-copy">Jump into a shared board using its 24-character workspace key.</p>
            <label class="field-label" for="workspace-key">Workspace key</label>
            <input id="workspace-key" #workspace class="text-field" maxlength="24" spellcheck="false" placeholder="e.g. 0a12…f9c4">
            <a class="button button-secondary" [routerLink]="['/w', workspace.value]">Open workspace <span>→</span></a>
            <small class="field-hint">Lowercase letters and numbers only</small>
          </article>

          <article class="tool-card panel">
            <div class="card-top"><span class="card-number">03</span><span class="card-icon">◌</span></div>
            <h3>Request review</h3>
            <p class="card-copy">Send a board to the review desk. An administrator will check its archived cards.</p>
            <label class="field-label" for="review-key">Workspace key</label>
            <input id="review-key" #review class="text-field" maxlength="24" spellcheck="false" placeholder="paste workspace key">
            <button class="button button-coral" [disabled]="reportBusy()" (click)="report(review.value)">
              {{ reportBusy() ? 'Sending…' : 'Send for review' }} <span>↗</span>
            </button>
            @if (reportResult()) { <pre class="status-block">{{ reportResult() }}</pre> }
          </article>
        </div>
      </section>

      <footer class="footer"><span>CHROMATIC STUDIO</span><span>Make something worth keeping.</span></footer>
    </main>
  `,
})
class HomeComponent {
  private readonly http = inject(HttpClient);
  readonly uploadResult = signal('');
  readonly reportResult = signal('');
  readonly uploadBusy = signal(false);
  readonly reportBusy = signal(false);

  upload(file: File | undefined): void {
    if (!file) {
      this.uploadResult.set('Choose an image first.');
      return;
    }
    this.uploadBusy.set(true);
    const data = new FormData();
    data.append('image', file);
    this.http.post('/api/media', data).subscribe({
      next: (value) => this.uploadResult.set(JSON.stringify(value, null, 2)),
      error: (error) => this.uploadResult.set(JSON.stringify(error.error ?? {error: 'upload failed'})),
      complete: () => this.uploadBusy.set(false),
    });
  }

  report(workspace: string): void {
    if (!workspace) {
      this.reportResult.set('Enter a workspace key first.');
      return;
    }
    this.reportBusy.set(true);
    this.http.post('/api/report', {workspace}).subscribe({
      next: (value) => this.reportResult.set(JSON.stringify(value)),
      error: (error) => this.reportResult.set(JSON.stringify(error.error ?? {error: 'report failed'})),
      complete: () => this.reportBusy.set(false),
    });
  }
}

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="app-shell workspace-shell">
      <header class="topbar">
        <a routerLink="/" class="brand" aria-label="Chromatic home">
          <span class="brand-mark"><i></i><i></i><i></i></span><span>chromatic</span>
        </a>
        <a routerLink="/" class="back">← Studio</a>
      </header>
      @if (loading()) {
        <section class="panel state"><span class="loader"></span>Opening workspace…</section>
      } @else if (error()) {
        <section class="panel state error"><span class="state-mark">!</span><div><strong>Workspace unavailable</strong><p>{{ error() }}</p></div></section>
      } @else if (manifest(); as board) {
        <header class="workspace-title">
          <div>
            <p class="eyebrow"><span>WORKSPACE</span><b>03</b></p>
            <h1>{{ board.name }}</h1>
            <p class="workspace-owner">Curated by <strong>{{ board.owner || 'anonymous' }}</strong></p>
          </div>
          <div class="workspace-meta"><span>{{ board.blocks.length }} cards</span><span class="pulse-dot"></span><span>live canvas</span></div>
        </header>
        <section class="board">
          @for (block of board.blocks; track $index) {
            <article class="board-block" [innerHTML]="rendered(block)"></article>
          }
        </section>
      }
    </main>
  `,
})
class WorkspaceComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly legacyBlocks = inject(LegacyBlocks);

  readonly workspace = signal('');
  readonly manifest = signal<WorkspaceManifest | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const workspace = params.get('workspace') || '';
      this.workspace.set(workspace);
      this.loading.set(true);
      this.http.get<WorkspaceManifest>(
        `/api/workspaces/manifest?workspace=${encodeURIComponent(workspace)}`,
      ).subscribe({
        next: (manifest) => {
          this.manifest.set(manifest);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('The workspace manifest could not be loaded.');
          this.loading.set(false);
        },
      });
    });
  }

  rendered(block: WorkspaceBlock) {
    return this.legacyBlocks.render(block);
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withFetch()),
    provideRouter([
      {path: '', component: HomeComponent},
      {path: 'w/:workspace', component: WorkspaceComponent},
      {path: '**', redirectTo: ''},
    ]),
  ],
}).catch((error: unknown) => console.error(error));
