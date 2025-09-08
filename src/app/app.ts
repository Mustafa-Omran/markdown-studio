import { Component } from '@angular/core';
import { MarkdownEditorComponent } from './components/markdown-editor';

@Component({
  selector: 'app-root',
  imports: [MarkdownEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
