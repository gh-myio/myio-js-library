declare module 'qrious' {
  interface QRiousOptions {
    value?: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    background?: string;
    foreground?: string;
  }

  export default class QRious {
    constructor(options?: QRiousOptions);
    toDataURL(mime?: string): string;
    value: string;
    size: number;
  }
}
