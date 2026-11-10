interface ImportDetails {
  type: string;
  names: string[];
}

interface ImportItem {
  id?: string; 
  file_name: string;
  path: string;
  details: ImportDetails;
  imports?: ImportItem[]; 
}

interface FileNode {
  id: string;
  file_name: string;
  type: string;
  path?: string; 
  details?: ImportDetails;
  imports?: ImportItem[];
}

interface Tree {
  children: FileNode[];
}

interface Metadata {
  totalFiles: number;
  totalImports: number;
  rootFile: string;
}

interface InputData {
  metadata: Metadata;
  tree: Tree;
}

interface Input {
  data: InputData;
}

interface TransformedData {
  data: {
      metadata: Metadata;
      tree: {
          children: FileNode[];
      };
  };
}

function transformData(input: Input): TransformedData {
  const { data } = input;

  function buildImportTree(fileMap: Record<string, FileNode>,
     node: FileNode): FileNode {
    if (!node.imports || node.imports.length === 0) {
      return { ...node, imports: [] };
    }

    return {
      ...node,
      imports: node.imports.map((importItem: ImportItem) => {
        const importedFile = fileMap[`${importItem.file_name}.ts`] 
        || fileMap[`${importItem.file_name}.d.ts`];
        if (importedFile) {
          return buildImportTree(fileMap, {
            id: importedFile.id,
            file_name: importItem.file_name,
            type: importedFile.type,
            path: importItem.path || '', 
            details: importItem.details,
            imports: importedFile.imports || [],
          });
        }
        return { ...importItem, imports: [] };
      }) as ImportItem[],
    };
  }

  const fileMap: Record<string, FileNode> = data.tree.children.
  reduce((map: Record<string, FileNode>, file: FileNode) => {
    map[file.id] = file;
    return map;
  }, {});

  const rootFile = fileMap[data.metadata.rootFile];

  if (!rootFile) {
    throw new Error(`Root file "${data.metadata.rootFile}" 
      not found in the tree.`);
  }

  const transformedTree = buildImportTree(fileMap, rootFile);

  const processedFiles = new Set(transformedTree.imports?.
    map(file => file.id) || []);

  return {
    data: {
      metadata: data.metadata,
      tree: {
        children: [transformedTree],
      },
    },
  };
}

export default transformData;
