export interface SyncConfig {
  enabled: boolean;
  watchInterval: number;
  syncInterval: number;
  retryInterval: number;
  maxAttempts: number;
  watchedPaths: string[];
  ignoredPaths: string[];
  autoCommit: boolean;
  autoPush: boolean;
  autoPull: boolean;
  branch: string;
  commitMessagePrefix: string;
}
