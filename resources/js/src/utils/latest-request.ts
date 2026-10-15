/** Ignore responses superseded by another request or a component detaching. */
export class LatestRequest {
  private version = 0;

  start(): () => boolean {
    const version = ++this.version;
    return () => version === this.version;
  }

  cancel(): void {
    this.version += 1;
  }
}
