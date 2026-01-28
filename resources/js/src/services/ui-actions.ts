export type UiAction = 'create' | 'import';

export class UiActionsService {
  private pending: UiAction | null = null;
  private target = new EventTarget();

  trigger(action: UiAction) {
    this.pending = action;
    this.target.dispatchEvent(new CustomEvent<UiAction>('action', { detail: action }));
  }

  consume(): UiAction | null {
    const action = this.pending;
    this.pending = null;
    return action;
  }

  onAction(handler: (action: UiAction) => void) {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<UiAction>).detail;
      this.pending = null;
      handler(detail);
    };
    this.target.addEventListener('action', listener);
    return () => this.target.removeEventListener('action', listener);
  }
}
