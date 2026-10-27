let current: ToastNotification | undefined;

/** Shows one short message. A new message replaces the one still on screen. */
export function notify(text: string): void {
  current?.delete();
  current = new ToastNotification('vulpes_environment_notice', { text, expire: 6000 });
}

export function clearNotice(): void {
  current?.delete();
  current = undefined;
}
