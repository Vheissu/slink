export type NotificationKind = 'success' | 'warning' | 'error';

export class NotificationService {
  notify(message: string, kind: NotificationKind = 'success') {
    console.info(`[${kind}] ${message}`);
  }
}
