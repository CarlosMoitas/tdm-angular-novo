import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { LoadingOverlay } from './shared/components/loading-overlay/loading-overlay';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingOverlay],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tdm-angular-novo');

  // Injetado aqui para aplicar o tema salvo/preferido assim que a app inicializa,
  // antes mesmo da Navbar ser renderizada.
  constructor(private readonly themeService: ThemeService) {}
}
