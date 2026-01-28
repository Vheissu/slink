import { Aurelia } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { ApiService } from './services/api';
import { AuthService } from './services/auth';

const host = document.querySelector('#app');
if (!host) {
  throw new Error('Aurelia host element not found');
}

const au = Aurelia
  .register(RouterConfiguration.customize({ useUrlFragmentHash: false }))
  .app({ component: MyApp, host });

const auth = au.container.get(AuthService);
const api = au.container.get(ApiService);
api.setToken(auth.getToken());

au.start();
