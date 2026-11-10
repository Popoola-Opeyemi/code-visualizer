import * as fs from "fs";
import * as path from "path";
import { UploadSessionInfo } from '../types/file';

class FileContext {
  private static sessionDir = path.resolve(__dirname, "../../sessions");
  // Ensure the session directory exists
  static ensureSessionDir() {
    if (!fs.existsSync(FileContext.sessionDir)) {
      fs.mkdirSync(FileContext.sessionDir, { recursive: true });
    }
  }

  static getFilePath(sessionId: string): string {
    return path.join(FileContext.sessionDir, `${sessionId}.json`);
  }

  static getFileContext(sessionId: string): UploadSessionInfo {
    const filePath = FileContext.getFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No file context found for session ID: ${sessionId}`);
    }
    const data = fs.readFileSync(filePath, "utf-8");
    try {
      const { fileInfo } = JSON.parse(data);
      return fileInfo;
    } catch (error) {
      throw new Error(`Failed to parse file context for session ID: ${sessionId}`);
    }
  }

  static hasFileContext(sessionId: string): boolean {
    return fs.existsSync(FileContext.getFilePath(sessionId));
  }

  static setFileContext(sessionId: string, fileInfo: UploadSessionInfo) {
    FileContext.ensureSessionDir();
    const filePath = FileContext.getFilePath(sessionId);
    const data = { fileInfo, timestamp: Date.now() };
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      throw new Error(`Failed to write file context for session ID: ${sessionId}`);
    }
  }

  static deleteFileContext(sessionId: string) {
    const filePath = FileContext.getFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    } else {
      console.warn(`No file context to delete for session ID: ${sessionId}`);
    }
  }

  static cleanupExpiredContexts(ttl: number) {
    FileContext.ensureSessionDir();
    const now = Date.now();
    const files = fs.readdirSync(FileContext.sessionDir);

    files.forEach((file) => {
      const filePath = path.join(FileContext.sessionDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (now - data.timestamp > ttl) {
          const { fileInfo } = data;
          if (fileInfo?.uploadPath && fs.existsSync(fileInfo.uploadPath)) {
            fs.rmSync(fileInfo.uploadPath, { recursive: true, force: true });
            console.log(`Deleted expired upload folder at path: ${fileInfo.uploadPath}`);
          }
          fs.unlinkSync(filePath);
          console.log(`Deleted expired file context for session ID: ${file.replace(".json", "")}`);
        }
      } catch (error) {
        console.error(`Failed to process file: ${file}, error: ${error}`);
      }
    });
  }

}

export default FileContext;
