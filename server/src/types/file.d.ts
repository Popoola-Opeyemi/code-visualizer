interface UploadedFileInfo {
  originalName: string;
  storedPath: string;
}

interface UploadSessionInfo {
  sessionId: string;
  uploadPath?: string;
  files?: FileInfoMap;
  timestamp?: Date;
}

interface FileInfoMap {
  [key: string]: UploadedFileInfo;  
}

export { UploadSessionInfo, UploadedFileInfo,FileInfoMap };
