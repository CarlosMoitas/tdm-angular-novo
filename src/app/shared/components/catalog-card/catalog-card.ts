import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogCard as CatalogCardModel } from '../../../core/models/catalog.model';

@Component({
  selector: 'app-catalog-card',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './catalog-card.html',
  styleUrl: './catalog-card.scss',
})
export class CatalogCard {
  @Input({ required: true }) card!: CatalogCardModel;
  @Output() generate = new EventEmitter<{ cardId: string; environment?: string; agency?: string }>();

  selectedEnvironment?: string;
  agency = '3995';

  onGenerate(): void {
    this.generate.emit({
      cardId: this.card.id,
      environment: this.selectedEnvironment,
      agency: this.card.requiresAgencyInput ? this.agency : undefined,
    });
  }
}
