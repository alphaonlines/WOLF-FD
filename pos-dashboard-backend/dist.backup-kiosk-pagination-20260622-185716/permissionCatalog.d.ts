export type PermissionScope = "module" | "dashboard_card" | "feature";
export type PermissionCatalogEntry = {
    key: string;
    label: string;
    scope: PermissionScope;
    description: string;
};
export declare const PERMISSION_CATALOG: PermissionCatalogEntry[];
export declare const ROLE_DEFAULT_PERMISSION_KEYS: Record<string, string[]>;
export declare function normalizePermissionKeyList(raw: any): string[];
export declare function isValidPermissionKey(key: string): boolean;
export declare function getRoleDefaultPermissionKeys(roleKey: string): string[];
