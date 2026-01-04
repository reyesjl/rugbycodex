declare module 'hls.js' {
  export type HlsConfig = Record<string, unknown>;

  export type HlsErrorData = {
    fatal?: boolean;
    type?: string;
    details?: string;
    reason?: string;
  };

  export default class Hls {
    constructor(config?: HlsConfig);
    static isSupported(): boolean;

    static Events: {
      ERROR: string;
    };

    on(eventName: string, listener: (event: string, data: HlsErrorData) => void): void;
    loadSource(url: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
  }
}
