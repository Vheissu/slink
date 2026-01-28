import { bindable } from 'aurelia';

export class LinkCard {
  @bindable title = '';
  @bindable slug = '';
  @bindable clicks = 0;
}
