export class DateFormatValueConverter {
  toView(value?: string | Date, locale = 'en-US'): string {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
  }
}
