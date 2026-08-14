import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoginFacade } from './login.facade';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  username = '';
  password = '';

  readonly loading;
  readonly errorMessage;

  constructor(private readonly loginFacade: LoginFacade) {
    this.loading = this.loginFacade.loading;
    this.errorMessage = this.loginFacade.errorMessage;
  }

  onSubmit(): void {
    this.loginFacade.submit(this.username, this.password);
  }
}
