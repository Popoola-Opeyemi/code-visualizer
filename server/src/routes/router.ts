import { Router, Request, Response, NextFunction } from "express";
import MulterMiddleware from '../middlewares/MulterMiddleware';
import controller from "../controllers/controller";

const router: Router = Router();

router.post(
  "/upload",
  MulterMiddleware.folderUploadMiddleware(),
  controller.uploadFolder
);

router.post(
  "/get-file-relationships",
  controller.GetFunctionsInFile
);

router.post(
  "/analyze-method-relationship",
  controller.AnalyzeMethodRelationship
);

export default router;