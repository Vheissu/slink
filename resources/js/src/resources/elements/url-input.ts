import { bindable } from 'aurelia';

export class UrlInput {
  @bindable label = 'Destination';
  @bindable placeholder = 'https://';
  @bindable value = '';
}
