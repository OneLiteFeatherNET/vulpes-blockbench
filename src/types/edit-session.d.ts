// Blockbench's EditSession class (internal, not a documented plugin API). Hand-written like
// blockbench.d.ts. Checked against the Blockbench 5.2 source, js/edit_sessions.js: the
// constructor (line 5), start (23), join (82), quit (131), matchToken (351) and defaults
// (364). Re-check these members on every Blockbench upgrade.

declare class EditSession {
  constructor();
  active: boolean;
  hosting: boolean;
  token?: string;
  username?: string;
  /** The connected peers, keyed by their id. */
  clients: Record<string, unknown>;
  client_count: number;
  /** Hosts a session. The username is a placeholder name when omitted. */
  start(username?: string): void;
  join(username: string, token: string): void;
  quit(): void;
  /** `ip` is the signaling host used by start and join. Placeholder names fill in a missing username, and max_chat_length limits chat text. */
  static defaults: {
    ip: string;
    placeholder_names: string[];
    max_chat_length: number;
  };
  /** True when the text has the shape of a session token. */
  static matchToken(token: string): boolean;
}
