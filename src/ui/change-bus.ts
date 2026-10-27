// Tells the listeners (the sidebar panel) that the environment, the selected project
// or a link changed. Blockbench events feed it; the plugin's own changes call `emit`.

type Listener = () => void;

const listeners = new Set<Listener>();
let handles: { delete(): void }[] = [];

export function emitVulpesChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Adds a listener. The returned function removes it and, with the last one, the Blockbench listeners too. */
export function subscribeVulpesChange(listener: Listener): () => void {
  listeners.add(listener);
  if (handles.length === 0) {
    handles = ['select_project', 'load_project', 'close_project'].map((event) => Blockbench.on(event, emitVulpesChange));
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      for (const handle of handles) {
        handle.delete();
      }
      handles = [];
    }
  };
}
