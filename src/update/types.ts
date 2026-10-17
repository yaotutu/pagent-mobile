export type AppRelease = {
  id: number;
  assetId: number;
  version: string;
  url: string;
  size: number;
};

export type UpdateStatus =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'current'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'cancelled'
  | 'error';

export type UpdateSnapshot = {
  status: UpdateStatus;
  currentVersion: string | null;
  unsupportedReason?: string;
  release?: AppRelease;
  bytesWritten: number;
  totalBytes?: number;
  busy: boolean;
  installAttempted: boolean;
  noticeVersion: number;
  error?: string;
  errorStage?: 'check' | 'download' | 'install';
  message?: string;
};

export type UpdateSheetProps = {
  snapshot: UpdateSnapshot;
  onClose: () => void;
  onCheck: () => void;
  onCancel: () => void;
  onInstall: () => void;
  onRetryDownload: () => void;
  onOpenSettings: () => void;
};
