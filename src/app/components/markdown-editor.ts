import { Component, ElementRef, ViewChild, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatButtons } from './format-buttons';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

marked.setOptions({ gfm: true, breaks: false });

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './markdown-editor.html',
  styleUrls: ['./markdown-editor.scss']
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('preview', { static: false }) previewRef?: ElementRef<HTMLElement>;
  @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLTextAreaElement>;

  protected readonly markdown = signal<string>(`
    # Welcome to Markdown Studio: Markdown Studio: Write, Preview, Export
    
    ✨ Features  

    Markdown Studio includes:  
    - 📝 **Markdown Editor** – Write and edit using Markdown syntax  
    - 👀 **Live Preview** – See your formatted content instantly  
    - 📑 **Export to PDF** – Save your notes or reports in PDF format  
    - 📂 **Resizable Layout** – Adjustable editor/preview panels with scrollbar  
    - 💡 **Syntax Highlighting** – Highlight code snippets for readability  
    - ⚡ **Lightweight & Fast** – Built with Angular 20 and TailwindCSS  
  `);

  protected readonly leftWidth = signal<number>(50);
  protected exportingPdf = signal(false);

  protected dragging = false;
  private onMouseMove?: (e: MouseEvent | TouchEvent) => void;
  private onMouseUp?: (e: MouseEvent | TouchEvent) => void;

  // Hover menu signals
  protected showMenu = signal(false);
  protected menuPosition = signal({ top: 0, left: 0 });
  private selectionRange: { start: number; end: number } | null = null;

  protected readonly renderedHtml = computed<SafeHtml>(() => {
    const html = marked.parse(this.markdown()) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  protected readonly formatButtons = formatButtons;
  protected theme = signal<'dark' | 'light'>('dark');

  constructor(private sanitizer: DomSanitizer) {
    effect(() => {
      // Re-run highlighting whenever the rendered HTML changes
      const _ = this.renderedHtml();
      queueMicrotask(() => this.applyHighlight());
    });

    this.formatButtons.map(btn => {
      btn.icon = this.sanitizer.bypassSecurityTrustHtml(btn.icon) as any;
    });
  }

  ngOnInit(): void {
    this.attachGlobalDragHandlers();
  }

  ngOnDestroy(): void {
    this.detachGlobalDragHandlers();
  }

  onInput(ev: Event) {
    const target = ev.target as HTMLTextAreaElement;
    this.markdown.set(target.value);
  }

  startDrag(ev: MouseEvent | TouchEvent) {
    ev.preventDefault();
    this.dragging = true;
  }

  private attachGlobalDragHandlers() {
    this.onMouseMove = (ev: MouseEvent | TouchEvent) => {
      if (!this.dragging) return;
      const container = this.containerRef.nativeElement;
      const rect = container.getBoundingClientRect();
      const clientX = ev instanceof MouseEvent ? ev.clientX : (ev.touches[0]?.clientX ?? 0);
      let percent = ((clientX - rect.left) / rect.width) * 100;
      percent = Math.max(20, Math.min(80, percent));
      this.leftWidth.set(percent);
    };
    this.onMouseUp = () => this.dragging = false;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchmove', this.onMouseMove, { passive: false });
    document.addEventListener('touchend', this.onMouseUp);
  }

  private detachGlobalDragHandlers() {
    if (this.onMouseMove) {
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('touchmove', this.onMouseMove);
    }
    if (this.onMouseUp) {
      document.removeEventListener('mouseup', this.onMouseUp);
      document.removeEventListener('touchend', this.onMouseUp);
    }
  }

  private applyHighlight() {
    const root = this.previewRef?.nativeElement;
    if (!root) return;
    root.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el as HTMLElement));
  }

  async exportPdf() {
    this.exportingPdf.set(true);

    try {
      const previewEl = this.previewRef?.nativeElement || this.containerRef.nativeElement;

      // Add temporary padding for export
      const originalPadding = previewEl.style.padding;
      previewEl.style.padding = '20px';

      const canvas = await html2canvas(previewEl, {
        backgroundColor: '#0b1220',
        scale: 3,
        useCORS: true,
        logging: false
      });

      previewEl.style.padding = originalPadding;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Total height of content in mm
      const totalHeightMm = (canvas.height / canvas.width) * pageWidth;

      let positionMm = 0;

      while (positionMm < totalHeightMm) {
        const remainingHeightMm = totalHeightMm - positionMm;
        const sliceHeightMm = Math.min(pageHeight, remainingHeightMm);

        const sliceHeightPx = Math.round((sliceHeightMm / totalHeightMm) * canvas.height);

        // Create slice canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;

        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(
          canvas,
          0,
          (positionMm / totalHeightMm) * canvas.height,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx
        );

        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImgHeight = (sliceHeightPx * imgWidth) / canvas.width;

        if (positionMm > 0) pdf.addPage();

        // 🟢 FIX: last page uses sliceHeightMm (no extra blank space)
        pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageImgHeight);

        positionMm += sliceHeightMm;
      }

      pdf.save('markdown-preview.pdf');
    } finally {
      this.exportingPdf.set(false);
    }
  }


  // ---------- Text selection menu logic ----------
  onTextSelect(ev: MouseEvent) {
    const textarea = this.editorRef.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      this.showMenu.set(false);
      return;
    }

    this.selectionRange = { start, end };

    const rect = textarea.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight || '16');
    const top = ev.clientY - rect.top - 40; // place menu above selection
    const left = ev.clientX - rect.left;

    this.menuPosition.set({ top, left });
    this.showMenu.set(true);
  }

  activeFormats = new Set<string>();

  applyFormat(type: string) {
    if (!this.selectionRange) return;

    const text = this.markdown();
    const { start, end } = this.selectionRange;
    const selected = text.slice(start, end);
    let formatted = selected;

    // Detect if already active
    const isActive = this.activeFormats.has(type);

    switch (type) {
      case 'bold':
        formatted = isActive
          ? selected.replace(/^\*\*(.*)\*\*$/, '$1') // remove
          : `**${selected}**`;
        break;

      case 'italic':
        formatted = isActive
          ? selected.replace(/^\*(.*)\*$/, '$1')
          : `*${selected}*`;
        break;

      case 'code':
        formatted = isActive
          ? selected.replace(/^`(.*)`$/, '$1')
          : `\`${selected}\``;
        break;

      case 'codeBlock':
        formatted = isActive
          ? selected.replace(/^```[\\s\\S]*```$/, selected) // remove
          : `\`\`\`\n${selected}\n\`\`\``;
        break;

      case 'underline':
        formatted = isActive
          ? selected.replace(/^<u>(.*)<\/u>$/, '$1')
          : `<u>${selected}</u>`;
        break;

      case 'strikethrough':
        formatted = isActive
          ? selected.replace(/^~~(.*)~~$/, '$1')
          : `~~${selected}~~`;
        break;

      case 'link':
        formatted = isActive
          ? selected.replace(/^\\[(.*)\\]\\(.*\\)$/, '$1')
          : `[${selected}](url)`;
        break;

      case 'h1': formatted = `# ${selected}`; break;
      case 'h2': formatted = `## ${selected}`; break;
      case 'h3': formatted = `### ${selected}`; break;
      case 'h4': formatted = `#### ${selected}`; break;

      case 'blockquote':
        formatted = isActive
          ? selected.replace(/^> /gm, '') // remove blockquote
          : `> ${selected}`;
        break;

      case 'ul':
        formatted = isActive
          ? selected.replace(/^- /gm, '')
          : selected.split('\n').map(line => `- ${line}`).join('\n');
        break;

      case 'ol':
        formatted = isActive
          ? selected.replace(/^\\d+\\. /gm, '')
          : selected.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
        break;
    }

    // Insert new text
    const newText = text.slice(0, start) + formatted + text.slice(end);
    this.markdown.set(newText);

    // Toggle active state
    if (isActive) {
      this.activeFormats.delete(type);
    } else {
      this.activeFormats.add(type);
    }

    // Reset selection
    setTimeout(() => {
      const textarea = this.editorRef.nativeElement;
      textarea.focus();
      textarea.setSelectionRange(start, start + formatted.length);
    });
  }

  toggleTheme() {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }
}
