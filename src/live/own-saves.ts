// Holds the `saved` events of an asset while this instance saves that asset, so the echo of an
// own save is not announced as someone else's. It is pure: the caller keeps the held items and
// processes the ones that are released.

/** How an own save ended. A saved outcome carries the ETag the save stored. */
export type OwnSaveOutcome = { readonly kind: 'saved'; readonly etag: string } | { readonly kind: 'failed' };

interface Window<T> {
  inFlight: number;
  readonly ownEtags: Set<string>;
  readonly held: { readonly etag: string; readonly item: T }[];
}

export interface OwnSaves<T> {
  /** An own save of the asset starts. */
  begin(assetKey: string): void;
  /** Holds an incoming event while an own save of its asset is in flight. Returns false when the event must be processed now. */
  hold(assetKey: string, etag: string, item: T): boolean;
  /**
   * An own save of the asset ends. Returns the held items to process now, which are all but the
   * ones whose ETag is one of the own saves of the window. Holding stops with the last own save.
   */
  finish(assetKey: string, outcome: OwnSaveOutcome): T[];
}

export function createOwnSaves<T>(): OwnSaves<T> {
  const windows = new Map<string, Window<T>>();

  return {
    begin: (assetKey: string): void => {
      const window = windows.get(assetKey) ?? { inFlight: 0, ownEtags: new Set<string>(), held: [] };
      window.inFlight += 1;
      windows.set(assetKey, window);
    },
    hold: (assetKey: string, etag: string, item: T): boolean => {
      const window = windows.get(assetKey);
      if (window === undefined) {
        return false;
      }
      window.held.push({ etag, item });
      return true;
    },
    finish: (assetKey: string, outcome: OwnSaveOutcome): T[] => {
      const window = windows.get(assetKey);
      if (window === undefined) {
        return [];
      }
      window.inFlight -= 1;
      if (outcome.kind === 'saved') {
        window.ownEtags.add(outcome.etag);
      }
      if (window.inFlight > 0) {
        return [];
      }
      windows.delete(assetKey);
      return window.held.filter((entry) => !window.ownEtags.has(entry.etag)).map((entry) => entry.item);
    },
  };
}
