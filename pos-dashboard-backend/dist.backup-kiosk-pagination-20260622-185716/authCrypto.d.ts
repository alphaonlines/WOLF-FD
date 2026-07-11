export declare function hashPassword(password: string, saltHex?: string): string;
export declare function verifyPassword(password: string, storedHash: string): boolean;
export declare function sha256Hex(value: string): string;
export declare function createSessionToken(): string;
