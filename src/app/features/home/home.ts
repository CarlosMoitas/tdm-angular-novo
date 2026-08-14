import { Component, OnInit, Signal, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../shared/components/navbar/navbar';
import { CatalogCard as CatalogCardComponent } from '../../shared/components/catalog-card/catalog-card';
import { HomeFacade } from './home.facade';
import { AuthService } from '../../core/services/auth.service';
import { Catalog } from '../../core/models/catalog.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, Navbar, CatalogCardComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  /**
   * IMPORTANTE: `selectedCatalogId`/`searchTerm` precisam ser Angular
   * Signals (não propriedades simples) para que o `computed()` abaixo os
   * reconheça como dependências reativas. Um `computed()` só recalcula
   * quando um signal LIDO durante sua execução muda — propriedades
   * simples atualizadas via [(ngModel)] não disparam recomputação, o que
   * fazia o filtro de busca parecer "não funcionar" (o campo digitava,
   * mas a lista nunca era refiltrada).
   */
  private readonly _selectedCatalogId = signal('');
  private readonly _searchTerm = signal('');

  get selectedCatalogId(): string {
    return this._selectedCatalogId();
  }
  set selectedCatalogId(value: string) {
    this._selectedCatalogId.set(value);
  }

  get searchTerm(): string {
    return this._searchTerm();
  }
  set searchTerm(value: string) {
    this._searchTerm.set(value);
  }

  readonly catalogs: Signal<Catalog[]>;
  readonly errorMessage: Signal<string | null>;
  readonly workflowLog;
  readonly filteredCards;

  constructor(
    private readonly homeFacade: HomeFacade,
    readonly authService: AuthService,
  ) {
    this.catalogs = this.homeFacade.catalogs;
    this.errorMessage = this.homeFacade.errorMessage;
    this.workflowLog = this.homeFacade.workflowLog;

    this.filteredCards = computed(() => {
      const catalogId = this._selectedCatalogId();
      const term = this._searchTerm().trim().toLowerCase();

      return this.homeFacade.cards().filter((card) => {
        const matchesCatalog = !catalogId || card.catalogId === catalogId;
        const matchesSearch =
          !term ||
          card.title.toLowerCase().includes(term) ||
          card.id.toLowerCase().includes(term) ||
          card.project.toLowerCase().includes(term);

        return matchesCatalog && matchesSearch;
      });
    });
  }

  ngOnInit(): void {
    this.homeFacade.loadInitialData();
  }

  onGenerate(event: { cardId: string; environment?: string; agency?: string }): void {
    this.homeFacade.generateMass(event.cardId, event.environment, event.agency);
  }
}
