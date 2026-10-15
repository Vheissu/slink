export function shortUrl(slug?: string | null): string {
  return slug ? `${window.location.origin}/${slug}` : '';
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Older browsers and non-secure origins may only support the legacy API.
  }

  const previousFocus = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  // A modal dialog makes the rest of the document inert.
  (document.querySelector('dialog[open]') ?? document.body).appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand('copy')) {
      throw new Error('Could not copy the link. Select the URL and copy it manually.');
    }
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
}
