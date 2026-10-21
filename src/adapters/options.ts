export interface ParseOptions {
  /** Stable document identity; node identities are deterministic within this parse. */
  readonly id?: string;
  /** Resolve relative HTTP(S) links and image paths against this absolute URL. */
  readonly baseUrl?: string;
}
