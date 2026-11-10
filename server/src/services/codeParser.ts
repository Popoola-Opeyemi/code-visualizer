import * as path from 'path';
import {
  Project, SourceFile, VariableDeclaration, ParameterDeclaration,
  ClassDeclaration, CallExpression, SyntaxKind, MethodDeclaration,
  FunctionDeclaration,
  VariableStatement,Node,
} from "ts-morph";

import { getFilesRecursively, isFile } from "../utils/crawlFolders";

import {
  DependencyData, TreeNode, ImportEntity, ClassMethods, Method, ImportDetail,
  FunctionCall, Link, CustomNode, VariableUsage,MethodCallInfo
} from "../types/ts-morph";

class TypeScriptDependencyAnalyzer {
  private project: Project;
  private sourceFiles: SourceFile[];
  private projectRootPath: string;

  constructor(directoryOrFilePath?: string) {
    this.project = new Project({});
    this.projectRootPath = directoryOrFilePath || process.cwd();

    if (directoryOrFilePath) {
      const isAFile = isFile(directoryOrFilePath);

      if (isAFile) {
        this.project.addSourceFileAtPath(directoryOrFilePath);
      } else {
        const files = getFilesRecursively(directoryOrFilePath);
        files.forEach((file) => {
          this.project.addSourceFileAtPath(file);
        });
      }
    }
    this.sourceFiles = this.project.getSourceFiles();
  }

  private isCustomImport(importPath: string,
    sourceFilePath: string): boolean {
    if (importPath.includes('node_modules')) return false;
    return (
      importPath.startsWith('.') ||
      importPath.startsWith('/') ||
      importPath.startsWith(this.projectRootPath)
    );
  }


  private getClassMethods(sourceFile: SourceFile): ClassMethods[] {
    const classMethods: ClassMethods[] = [];
    sourceFile.getClasses().forEach((classDeclaration: ClassDeclaration) => {
      const className = classDeclaration.getName() || "<anonymous>";
      const methods = classDeclaration.getMethods().map((method: MethodDeclaration) => {
        const name = method.getName();
        const startPos = method.getNameNode().getStartLinePos();
        const { line, column } = sourceFile.getLineAndColumnAtPos(startPos);
        const variables = this.getVariables(sourceFile, name); // Get variables used in this method
        return { name, line, column, variables };
      });
      classMethods.push({ className, methods });
    });
    return classMethods;
  }

  private getTopLevelFunctions(sourceFile: SourceFile): Method[] {
    const topLevelFunctions: Method[] = [];
  
    sourceFile.getFunctions().forEach((functionDeclaration: FunctionDeclaration) => {
      const name = functionDeclaration.getName() || "<anonymous>";
      const startPos = functionDeclaration.getNameNode()?.getStartLinePos() || functionDeclaration.getStart();
      const { line, column } = sourceFile.getLineAndColumnAtPos(startPos);
      const variables = this.getVariables(sourceFile, name); // Get variables used in this function
      topLevelFunctions.push({ name, line, column, variables });
    });
  
    // Handle arrow functions and const-declared functions
    sourceFile.getVariableDeclarations().forEach((variableDeclaration: VariableDeclaration) => {
      const initializer = variableDeclaration.getInitializer();
      if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
        const name = variableDeclaration.getName();
        const startPos = variableDeclaration.getStart();
        const { line, column } = sourceFile.getLineAndColumnAtPos(startPos);
        const variables = this.getVariables(sourceFile, name); // Get variables used in this function
        topLevelFunctions.push({ name, line, column, variables });
      }
    });
  
    return topLevelFunctions;
  }

  private getImports(sourceFile: SourceFile): ImportEntity[] {
    return sourceFile.getImportDeclarations().map((importDecl) => ({
      module: importDecl.getModuleSpecifierValue(),
      namedImports: importDecl.getNamedImports().map((named) => named.
        getName()),
    }));
  }

  private getMethodCalls(sourceFile: SourceFile): FunctionCall[] {
    const methodCalls: FunctionCall[] = [];
    const classMethodsMap: { [className: string]: Set<string> } = {};

    // build a map of class names to their methods
    this.getClassMethods(sourceFile).forEach(({ className, methods }) => {
      classMethodsMap[className] = new Set(methods.map(method => method.name));
    });

    // process methods within classes
    sourceFile.getClasses().forEach((classDeclaration: ClassDeclaration) => {
      const className = classDeclaration.getName() || "<anonymous>";
      const classMethods = classMethodsMap[className] || new Set();

      classDeclaration.getMethods().forEach((method: MethodDeclaration) => {
        const methodName = method.getName();
        const calledFunctionsSet: Set<string> = new Set();

        method.getDescendantsOfKind(SyntaxKind.CallExpression).
          forEach((callExpression) => {
            const expression = callExpression.getExpression();
            if (expression.getText().startsWith("this.")) {
              const calledMethodName = expression.getText().substring(5);
              if (classMethods.has(calledMethodName)) {
                calledFunctionsSet.add(calledMethodName);
              }
            }
          });
        // Convert Set to array for deduplicated calls
        const calledFunctions = Array.from(calledFunctionsSet);
        methodCalls.push({ className, methodName, calledFunctions });
      });
    });

    // Process top-level functions
    sourceFile.getFunctions().forEach((functionDeclaration:
      FunctionDeclaration) => {
      const functionName = functionDeclaration.getName() || "<anonymous>";
      const calledFunctionsSet: Set<string> = new Set();

      functionDeclaration.getDescendantsOfKind(SyntaxKind.
        CallExpression).forEach((callExpression: CallExpression) => {
          const expression = callExpression.getExpression();
          calledFunctionsSet.add(expression.getText());
        });

      // Convert Set to array for deduplicated calls
      const calledFunctions = Array.from(calledFunctionsSet);
      methodCalls.push({ methodName: functionName, calledFunctions });
    });

    return methodCalls;
  }

  private getVariables(sourceFile: SourceFile, functionName?: string): VariableUsage[] {
    const variables: VariableUsage[] = [];
  
    // find the function or method declaration
    const functionDeclaration = sourceFile.getFunction(functionName || "") ||
      sourceFile.getClasses().flatMap(cls => cls.getMethods()).find(method => method.getName() === functionName) ||
      sourceFile.getVariableDeclarations().find(variable => {
        const initializer = variable.getInitializer();
        return initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression);
      });
  
    if (!functionDeclaration) {
      return variables;
    }
  
    // handle function parameters
    if ('getParameters' in functionDeclaration) {
      functionDeclaration.getParameters().forEach((param: ParameterDeclaration) => {
        const paramName = param.getName();
        const typeObj = param.getType();
        let type = 'unknown';
  
        // Simplify the type
        if (typeObj.isString()) {
          type = 'string';
        } else if (typeObj.isNumber()) {
          type = 'number';
        } else if (typeObj.isBoolean()) {
          type = 'boolean';
        } else if (typeObj.isArray()) {
          type = 'array';
        } else if (typeObj.isObject()) {
          type = 'object';
        } else if (typeObj.isUndefined()) {
          type = 'undefined';
        } else if (typeObj.isNull()) {
          type = 'null';
        } else if (typeObj.isBigInt()) {
          type = 'bigint';
        }
  
        // track parameter usage
        const usedIn: Array<{ functionName: string; line: number; column: number }> = [];
        const references = param.findReferences();
        references.forEach(reference => {
          reference.getReferences().forEach(ref => {
            const node = ref.getNode();
            const parent = node.getParent();
  
            if (parent && (parent.getKind() === SyntaxKind.CallExpression ||
              parent.getKind() === SyntaxKind.FunctionDeclaration ||
              parent.getKind() === SyntaxKind.MethodDeclaration)) {
              const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
              usedIn.push({ functionName: functionName || "<anonymous>", line, column });
            }
          });
        });
  
        variables.push({
          variableName: paramName,
          exportedFrom: sourceFile.getFilePath(),
          type,
          usedIn,
          isParameter: true
        });
      });
    }
  
    // Step 3: Handle local variable declarations in the function body
    if ('getBody' in functionDeclaration) {
      const body = functionDeclaration.getBody();
      if (body && body.getKind() === SyntaxKind.Block) {
        // Traverse the statements in the function body
        body.getDescendantStatements().forEach(statement => {
          if (statement.getKind() === SyntaxKind.VariableStatement) {
            const variableStatement = statement as VariableStatement;
            variableStatement.getDeclarations().forEach(declaration => {
              const variableName = declaration.getName();
              const typeObj = declaration.getType();
              let type = 'unknown';
  
              // get type 
              if (typeObj.isString()) {
                type = 'string';
              } else if (typeObj.isNumber()) {
                type = 'number';
              } else if (typeObj.isBoolean()) {
                type = 'boolean';
              } else if (typeObj.isArray()) {
                type = 'array';
              } else if (typeObj.isObject()) {
                type = 'object';
              } else if (typeObj.isUndefined()) {
                type = 'undefined';
              } else if (typeObj.isNull()) {
                type = 'null';
              } else if (typeObj.isBigInt()) {
                type = 'bigint';
              }
  
              // Track variable usage
              const usedIn: Array<{ functionName: string; line: number; column: number }> = [];
              const references = declaration.findReferences();
              references.forEach(reference => {
                reference.getReferences().forEach(ref => {
                  const node = ref.getNode();
                  const parent = node.getParent();
  
                  if (parent && (parent.getKind() === SyntaxKind.CallExpression ||
                    parent.getKind() === SyntaxKind.FunctionDeclaration ||
                    parent.getKind() === SyntaxKind.MethodDeclaration)) {
                    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
                    usedIn.push({ functionName: functionName || "<anonymous>", line, column });
                  }
                });
              });
  
              variables.push({
                variableName,
                exportedFrom: sourceFile.getFilePath(),
                type,
                usedIn,
                isParameter: false
              });
            });
          }
        });
      }
    }
  
    return variables;
  }
  
  private getFileNameFromPath(filePath: string): string {
    return path.basename(filePath).replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  private createNode(filePath: string): TreeNode {
    const relativePath = path.relative(this.projectRootPath, filePath);
    return {
      id: relativePath,
      file_name: path.basename(filePath),
      type: 'file',
      imports: []
    };
  }



  private analyzeImports(sourceFile: SourceFile): ImportDetail[] {
    const imports: ImportDetail[] = [];

    sourceFile.getImportDeclarations().forEach(importDecl => {
      const importPath = importDecl.getModuleSpecifierValue();

      if (!this.isCustomImport(importPath, sourceFile.getFilePath())) {
        return;
      }

      const importDetail: ImportDetail = {
        file_name: this.getFileNameFromPath(importPath),
        path: importPath,
        details: {
          type: 'named',
          names: []
        }
      };

      // Analyze import types
      const defaultImport = importDecl.getDefaultImport();
      const namespaceImport = importDecl.getNamespaceImport();
      const namedImports = importDecl.getNamedImports();

      if (defaultImport) {
        importDetail.details.type = 'default';
        importDetail.details.names.push(defaultImport.getText());
      } else if (namespaceImport) {
        importDetail.details.type = 'namespace';
        importDetail.details.names.push(namespaceImport.getText());
      } else {
        namedImports.forEach(namedImport => {
          importDetail.details.names.push(namedImport.getName());
        });
      }
      imports.push(importDetail);
    });

    return imports;
  }

  public analyzeMethodCalls(functionName: string, filename: string): MethodCallInfo[] {
    const methodCalls: MethodCallInfo[] = [];
  
    // Get the SourceFile object for the provided filename
    const sourceFile = this.sourceFiles.find(file => file.getFilePath().endsWith(filename));
    if (!sourceFile) {
      console.warn(`File "${filename}" not found in the provided source files.`);
      return methodCalls;
    }
  
    // Find the target function in the provided sourceFile
    const targetFunction = sourceFile.getFunction(functionName) ||
      sourceFile.getClasses()
        .flatMap(cls => cls.getMethods())
        .find(method => method.getName() === functionName);
  
    if (!targetFunction) {
      console.warn(`Function "${functionName}" not found in the file "${filename}".`);
      return methodCalls;
    }
  
    // Get all function calls within the target function
    const functionCalls = targetFunction.getBody()?.getDescendantsOfKind(SyntaxKind.CallExpression) || [];
  
    // Create a set of all function names defined in the this.sourceFiles[]
    const definedFunctions = new Set<string>();
    this.sourceFiles.forEach(file => {
      file.getFunctions().forEach(func => definedFunctions.add(func.getName()?.toString() || ""));
      file.getClasses().forEach(cls => {
        cls.getMethods().forEach(method => definedFunctions.add(method.getName()));
      });
    });
  
    // analyze each function call
    functionCalls.forEach(call => {
      const expression = call.getExpression();
  
      if (Node.isIdentifier(expression)) {
        const functionName = expression.getText();
  
        // Check if the function is defined in the sourceFiles[]
        if (definedFunctions.has(functionName)) {
          // Find the source file where the function is defined
          const sourceFile = this.sourceFiles.find(file =>
            file.getFunctions().some(func => func.getName() === functionName) ||
            file.getClasses().some(cls => cls.getMethods().some(method => method.getName() === functionName))
          );
  
          if (sourceFile) {
            methodCalls.push({
              functionName,
              calledIn: targetFunction.getName(),
              definedIn: sourceFile.getFilePath(),
              line: call.getStartLineNumber(),
              column: call.getEndLineNumber(),
            });
          }
        }
      }
    });
  
    return methodCalls;
  }


  public analyzeFileDependencies(): Object {
    const sourceFile = this.sourceFiles[0];
  
    const nodes: CustomNode[] = [];
    const links: Link[] = [];
    const nodeSet = new Set<string>();
  
    const classMethods = this.getClassMethods(sourceFile);
    const topLevelFunctions = this.getTopLevelFunctions(sourceFile);
    const methodCalls = this.getMethodCalls(sourceFile);
    const imports = this.getImports(sourceFile);
  
    // Add class methods to nodes
    classMethods.forEach(({ className, methods }) => {
      methods.forEach(method => {
        const nodeId = `${className}.${method.name}`;
        if (!nodeSet.has(nodeId)) {
          nodes.push({ id: nodeId, group: 1 });
          nodeSet.add(nodeId);
        }
      });
    });
  
    // Add top-level functions to nodes
    topLevelFunctions.forEach(func => {
      if (!nodeSet.has(func.name)) {
        nodes.push({ id: func.name, group: 2 });
        nodeSet.add(func.name);
      }
    });
  
    // Add links based on method calls
    methodCalls.forEach(({ className, methodName, calledFunctions }) => {
      if (methodName) {
        const sourceId = className ? `${className}.${methodName}` : methodName;
        calledFunctions.forEach(targetFunc => {
          const targetId = targetFunc.startsWith("this.")
            ? `${className}.${targetFunc.substring(5)}`
            : targetFunc;
  
          if (nodeSet.has(sourceId) && nodeSet.has(targetId)) {
            links.push({
              source: sourceId,
              target: targetId,
              value: 1
            });
          }
        });
      }
    });
  
    // Get number of classes
    const numberOfClasses = classMethods.length;
    const numberOfFunctions = topLevelFunctions.length;
  
    // Process top-level functions
    const functionDetails = topLevelFunctions.map(func => {
      const functionCall = methodCalls.find(call => call.methodName === func.name);
      const parameters = sourceFile
        .getFunction(func.name || "")
        ?.getParameters()
        .map(param => ({
          name: param.getName(),
          type: param.getType().getText(),
        })) || [];
  
      return {
        name: func.name,
        visibility: "", // Top-level functions don't have visibility
        calledFunctions: functionCall?.calledFunctions || [],
        parameters,
        variables: func.variables, // Include variables used in this function
      };
    });
  
    const functions = {
      noOfFunctions: functionDetails.length,
      methodNames: functionDetails,
    };
  
    // Format the class methods to match the ClassMethods interface
    const formattedClasses: ClassMethods[] = classMethods.map(({ className, methods }) => {
      return {
        className,
        methods: methods.map(method => ({
          name: method.name,
          line: method.line,
          column: method.column,
          calledFunctions: methodCalls
            .find(mc => mc.className === className && mc.methodName === method.name)
            ?.calledFunctions || [],
          variables: method.variables, // Include variables used in this method
        })),
      };
    });
  
    return {
      classMethods: formattedClasses,
      functions,
      imports,
      numberOfClasses,
      numberOfFunctions,
    };
  }

  public analyzeDependencies(): DependencyData {
    const nodes: TreeNode[] = [];
    let totalImports = 0;

    this.sourceFiles.forEach(sourceFile => {
      const node = this.createNode(sourceFile.getFilePath());
      node.imports = this.analyzeImports(sourceFile);
      totalImports += node.imports.length;
      nodes.push(node);
    });

    // Find server file or default to first file
    const serverFile = nodes.find(n => n.file_name.
      includes('server'))?.file_name || nodes[0].file_name;

    return {
      data: {
        metadata: {
          totalFiles: nodes.length,
          totalImports,
          rootFile: serverFile
        },
        tree: {
          children: nodes
        }
      }
    };
  }
}

export default TypeScriptDependencyAnalyzer;