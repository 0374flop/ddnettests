export declare function ensureServer(): Promise<void>;
export declare function translateText(text: string, sourceLang?: string, targetLang?: string): Promise<string>;
export declare function stopServer(): void;
export declare function gracefulShutdown(): Promise<void>;
