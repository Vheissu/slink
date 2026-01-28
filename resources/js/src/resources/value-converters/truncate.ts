export class TruncateValueConverter {
  toView(value?: string, limit = 42): string {
    if (!value) {
      return '';
    }
    if (value.length <= limit) {
      return value;
    }
    return `${value.slice(0, limit)}...`;
  }
}
