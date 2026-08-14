import { Project, SyntaxKind, TypeNode } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('src/**/*.ts');

for (const sourceFile of sourceFiles) {
  let changed = false;

  const anyKeywords = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);

  for (const anyNode of anyKeywords.reverse()) {
    const parent = anyNode.getParent();
    
    // Pattern: `err: any` in catch blocks or parameters
    if (parent.getKind() === SyntaxKind.Parameter || parent.getKind() === SyntaxKind.VariableDeclaration) {
      const name = parent.compilerNode.name ? parent.compilerNode.name.getText() : '';
      if (name === 'err' || name === 'error' || name === 'req' || name === 'res' || name === 'next') {
        if (name === 'err' || name === 'error') {
          anyNode.replaceWithText('unknown');
          changed = true;
        } else if (name === 'req' || name === '_req') {
          anyNode.replaceWithText('express.Request');
          // ensure express is imported
          if (!sourceFile.getImportDeclaration('express')) {
            sourceFile.addImportDeclaration({
              defaultImport: 'express',
              moduleSpecifier: 'express'
            });
          }
          changed = true;
        } else if (name === 'res' || name === '_res') {
          anyNode.replaceWithText('express.Response');
          changed = true;
        }
      }
    }

    // Pattern: `as any`
    if (parent.getKind() === SyntaxKind.AsExpression) {
      anyNode.replaceWithText('unknown');
      changed = true;
    }
  }

  if (changed) {
    sourceFile.saveSync();
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}
