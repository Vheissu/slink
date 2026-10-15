import { Aurelia } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';

const host = document.querySelector<HTMLElement>('#app');
if (!host) {
  throw new Error('Aurelia host element not found');
}

const au = Aurelia
  .register(RouterConfiguration.customize({ useUrlFragmentHash: false, useHref: false }))
  .app({ component: MyApp, host });

au.start();
