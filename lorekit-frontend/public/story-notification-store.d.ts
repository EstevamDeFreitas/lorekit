export function setNotificationAccount(accountId: string | null): Promise<void>;
export function notificationAccount(): Promise<string | null>;
export function claimNotification(accountId: string, eventId: string): Promise<boolean>;
