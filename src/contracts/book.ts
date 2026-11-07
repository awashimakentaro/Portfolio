export type BookPublicState = 'browsing' | 'reading' | 'returning';
export type BookLifecycleCallbacks = { onStatusChange?: (status: BookPublicState) => void; onClosed?: () => void };
