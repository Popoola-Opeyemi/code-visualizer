import fs from 'fs';
import path from 'path';

function isFile(pathStr: string): boolean {
  try {
    return require("fs").statSync(pathStr).isFile();
  } catch {
    return false;
  }
}

function getFilesRecursively(dirPath: string): string[] {
    let filePaths: string[] = [];

    const items = fs.readdirSync(dirPath);
    
    items.forEach((item) => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        filePaths = filePaths.concat(getFilesRecursively(fullPath));
      } else if (fullPath.endsWith('.ts')) {
        filePaths.push(fullPath);
      }
    });
    return filePaths;
}

export {
  isFile,
  getFilesRecursively
};
