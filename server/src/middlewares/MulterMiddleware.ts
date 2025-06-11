import { Request, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID, randomBytes } from 'crypto';
import { UploadSessionInfo, FileInfoMap } from '../types/file';
import FileContext from '../services/fileSessions';

interface MulterFile extends Express.Multer.File {
  fieldname: string;
}

class MulterMiddleware {
  private upload: multer.Multer;
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.join(__dirname, '../../uploads');
    fs.mkdirSync(this.baseUploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (req: Request, file: MulterFile, cb) => {
        try {
          if (!req.customFolder) {
            req.customFolder = randomUUID();
          }
          const uploadDir = path.join(this.baseUploadDir,
             req.customFolder);
          fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error as Error, '');
        }
      },
      filename: (_req: Request, file: Express.Multer.File, cb) => {
        cb(null, file.originalname);
      },
    });

    this.upload = multer({ storage });
  }

  public folderUploadMiddleware(): RequestHandler {
    return (req: Request, res, next) => {
      this.upload.array('files')(req, res, (err) => {
        if (err) {
          return next(err);
        }

        if (req.customFolder) {
          const sessionId = randomBytes(16).toString('hex');
          const uploadedFiles = req.files as MulterFile[];
          req.sessionId = sessionId;
          const fileInfoMap: FileInfoMap = uploadedFiles.
          
          // check through each file and map the original name to the stored path
          reduce((map, file) => {
            map[file.originalname] = {
              originalName: file.originalname,
              storedPath: file.path,
            };
            return map;
          }, {} as FileInfoMap);

          // add the session info to the file context
          const fileInfo: UploadSessionInfo = {
            sessionId,
            uploadPath: path.join(this.baseUploadDir, req.customFolder),
            files: fileInfoMap,
            timestamp: new Date(), 
          };

          FileContext.setFileContext(sessionId, fileInfo);
        }
        next();
      });
    };
  }

  public getUploadPath(session: string): string {
    const resolvedPath = path.join(this.baseUploadDir, session);
    return resolvedPath;
  }
}

export default new MulterMiddleware();
