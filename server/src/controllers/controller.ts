import { Request, response, Response } from 'express';
import CodeParserService from "../services/codeParser";
import transformData from '../utils/transformer';
import FileContext from '../services/fileSessions';
import path from 'path';
import express from '../types/express';

class UploadController {
  public async uploadFolder(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        res.status(400).json({ message: "No files uploaded" });
        return;
      }
      
      const uploadFolderPath = path.join(__dirname, `../../uploads/${req.customFolder}`);
      
      const sessionId = req.sessionId;
      const parser = new CodeParserService(uploadFolderPath);
      const analysis = parser.analyzeDependencies();

      const transform = transformData(analysis);

      res.status(200).json({
        sessionId,
        data: transform.data,
        analysis: analysis,
      });

    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error uploading folder', error });
    }
  }

  public async GetFunctionsInFile(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, file_name } = req.body;

      if (!sessionId || !FileContext.hasFileContext(sessionId)) {
        res.status(400).json({ error: "Invalid or missing session." });
        return;
      }

      console.log("sessionId", sessionId);
      console.log("file_name", file_name);

      const fileContext = FileContext.getFileContext(sessionId)
      .files?.[file_name];

      if (!file_name || !fileContext) {
        res.status(400).json({ error: "Invalid or missing file name." });
        return;
      }
      
      const fileInfo = new CodeParserService(fileContext.storedPath);
      const fileDependencies = fileInfo.analyzeFileDependencies();

      console.log("result", fileDependencies);


      res.status(200).json({
        data: fileDependencies,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching methods', error });
    }
  }

  public async AnalyzeMethodRelationship(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, file_name, method_name } = req.body;

      if (!sessionId || !FileContext.hasFileContext(sessionId)) {
        res.status(400).json({ error: "Invalid or missing session." });
        return;
      }

      
      const fileContext = FileContext.getFileContext(sessionId)
      
      if (!file_name || !fileContext) {
        res.status(400).json({ error: "Invalid or missing file name." });
        return;
      }
      
      console.log("sessionId", sessionId);
      console.log("file_name", file_name);
      console.log("method_name", method_name);
      
      const fileInfo = new CodeParserService(fileContext.uploadPath);
      const methodRelationship = fileInfo.analyzeMethodCalls(method_name,file_name);

      console.log("result", methodRelationship);

      res.status(200).json({
        data: methodRelationship,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching methods', error });
    }
  }
}

export default new UploadController();
