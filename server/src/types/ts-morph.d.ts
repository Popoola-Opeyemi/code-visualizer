interface ClassMethods {
  className: string;
  methods: Method[];
}

interface ImportEntity {
  module: string;
  namedImports: string[];
}
interface CustomNode {
  id: string;
  group: number; // 1 for class methods, 2 for functions
}

interface Link {
  source: string;
  target: string;
  value: number;
}

type MethodCallInfo = {
  functionName: string;
  calledIn?: string;
  definedIn: string;
  line: number;
  column?: number;
  className?: string;
};


interface VariableUsage {
  variableName: string;
  exportedFrom: string;
  type: string;
  isParameter: boolean;
  usedIn: Array<{
      functionName: string;
      line: number;
      column: number;
  }>;
}

interface FunctionCall {
  className?: string;
  methodName?: string;
  calledFunctions: string[];
}

interface methodInfo{
  variables: Variable[];
  methodCalls: String[];
}

interface Method {
  name: string;
  line: number;
  column: number;
  variables: Variable[];
  calledFunctions?: string[];
  parameters?: { name: string, type: string }[];
}


interface ImportDetail {
  file_name: string;
  path: string;
  details: {
    type: 'default' | 'namespace' | 'named';
    names: string[];
  };
}

interface TreeNode {
  id: string;
  file_name: string;
  type: 'file' | 'directory';
  imports: ImportDetail[];
  children?: TreeNode[];
}

interface DependencyData {
  data: {
    metadata: {
      totalFiles: number;
      totalImports: number;
      rootFile: string;
    };
    tree: {
      children: TreeNode[];
    };
  };
}

// Enhanced types for visualization
interface DependencyNode {
  id: string;
  label: string;
  type: 'file';
  level: number;
  imports: number;
  exports: number;
  size: number;
  group: string;
}

interface DependencyLink {
  source: string;
  target: string;
  value: number;
  type: 'default' | 'namespace' | 'named';
  names: string[];
}

interface DependencyGraph {
  nodes: DependencyNode[];
  links: DependencyLink[];
  metadata: {
    totalFiles: number;
    totalImports: number;
    rootFile: string;
    maxDepth: number;
  };
}

export {
  ImportDetail, TreeNode, DependencyData, DependencyNode,
  DependencyLink, DependencyGraph, ClassMethods, Method,
  ImportEntity,VariableUsage,Variable,FunctionCall,CustomNode,
  Link,methodInfo,MethodCallInfo
};
