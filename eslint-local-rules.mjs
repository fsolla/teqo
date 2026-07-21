const isUppercaseName = (node) =>
  node.type === 'Identifier' && /^[A-Z][A-Za-z0-9]*$/.test(node.name)

const isJsx = (node) => node?.type === 'JSXElement' || node?.type === 'JSXFragment'

const noComponentDefaultExport = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require ordinary React components to use named exports',
    },
    schema: [],
    messages: {
      defaultExport: 'React component files must not use default exports.',
    },
  },
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: 'defaultExport' })
      },
    }
  },
}

const frameworkDefaultExport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require Next framework components to use inline named function defaults',
    },
    schema: [],
    messages: {
      invalidDefault:
        'Next framework components must default-export an inline named function declaration.',
      missingDefault: 'Next framework components must have a default export.',
    },
  },
  create(context) {
    let hasDefaultExport = false

    return {
      ExportDefaultDeclaration(node) {
        hasDefaultExport = true
        const declaration = node.declaration
        const isNamedFunction =
          declaration.type === 'FunctionDeclaration' && declaration.id !== null

        if (!isNamedFunction) {
          context.report({ node, messageId: 'invalidDefault' })
        }
      },
      'Program:exit'(node) {
        if (!hasDefaultExport) {
          context.report({ node, messageId: 'missingDefault' })
        }
      },
    }
  },
}

const componentArrowConventions = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require const component arrows and implicit returns for pure JSX bodies',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useConst: 'Uppercase component arrow declarations must use const.',
      implicitReturn: 'Pure JSX component arrow bodies must use an implicit return.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode

    return {
      VariableDeclarator(node) {
        if (!isUppercaseName(node.id) || node.init?.type !== 'ArrowFunctionExpression') {
          return
        }

        const declaration = node.parent

        if (declaration.type === 'VariableDeclaration' && declaration.kind !== 'const') {
          context.report({ node: node.id, messageId: 'useConst' })
        }

        const body = node.init.body

        if (
          body.type !== 'BlockStatement' ||
          body.body.length !== 1 ||
          body.body[0].type !== 'ReturnStatement' ||
          !isJsx(body.body[0].argument)
        ) {
          return
        }

        const returnedJsx = sourceCode.getText(body.body[0].argument)
        const hasComments = sourceCode.getCommentsInside(body).length > 0

        context.report({
          node: body,
          messageId: 'implicitReturn',
          ...(hasComments
            ? {}
            : {
                fix: (fixer) => fixer.replaceText(body, `(${returnedJsx})`),
              }),
        })
      },
    }
  },
}

const isFunctionNode = (node) =>
  node?.type === 'FunctionDeclaration' ||
  node?.type === 'FunctionExpression' ||
  node?.type === 'ArrowFunctionExpression'

const isAsyncFunctionNode = (node) => isFunctionNode(node) && node.async === true

const isUseServerDirectiveStatement = (statement) =>
  statement?.type === 'ExpressionStatement' &&
  statement.expression?.type === 'Literal' &&
  statement.expression.value === 'use server'

const hasTopLevelUseServer = (program) =>
  Array.isArray(program.body) && program.body.some(isUseServerDirectiveStatement)

const isTypeOnlyNamedExport = (node) => {
  if (node.exportKind === 'type') return true

  const declaration = node.declaration
  if (!declaration) return false

  return (
    declaration.type === 'TSTypeAliasDeclaration' ||
    declaration.type === 'TSInterfaceDeclaration' ||
    declaration.type === 'TSModuleDeclaration'
  )
}

const resolveLocalAsyncBinding = (program, name) => {
  for (const statement of program.body) {
    if (statement.type === 'FunctionDeclaration' && statement.id?.name === name) {
      return isAsyncFunctionNode(statement)
    }

    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.id?.type === 'Identifier' && declarator.id.name === name) {
          return isAsyncFunctionNode(declarator.init)
        }
      }
    }
  }

  return false
}

/**
 * Next.js rejects any non-async-function export from a top-level `'use server'`
 * module (https://nextjs.org/docs/messages/invalid-use-server-value). Inspired by
 * eslint-plugin-next-recommended's export-server-actions-only, kept local because
 * that package is unmaintained and ESLint-8-era.
 */
const useServerAsyncExports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require top-level `use server` modules to export only async functions (plus type-only exports)',
    },
    schema: [],
    messages: {
      nonAsyncExport:
        'A `"use server"` file can only export async functions (found non-async export). Move constants, types-as-values, and helpers to a separate module. See https://nextjs.org/docs/messages/invalid-use-server-value',
      reexport:
        'A `"use server"` file cannot re-export values (`export … from` / `export *`). Export async functions defined in this file only.',
    },
  },
  create(context) {
    let programNode = null
    let useServer = false

    const report = (node, messageId) => {
      context.report({ node, messageId })
    }

    return {
      Program(node) {
        programNode = node
        useServer = hasTopLevelUseServer(node)
      },

      ExportAllDeclaration(node) {
        if (!useServer) return
        if (node.exportKind === 'type') return
        report(node, 'reexport')
      },

      ExportDefaultDeclaration(node) {
        if (!useServer) return

        const declaration = node.declaration
        if (isAsyncFunctionNode(declaration)) return

        if (declaration?.type === 'Identifier' && programNode) {
          if (resolveLocalAsyncBinding(programNode, declaration.name)) return
        }

        report(node, 'nonAsyncExport')
      },

      ExportNamedDeclaration(node) {
        if (!useServer) return
        if (isTypeOnlyNamedExport(node)) return

        if (node.source) {
          const hasValueSpecifier =
            !node.specifiers?.length ||
            node.specifiers.some((specifier) => specifier.exportKind !== 'type')
          if (hasValueSpecifier) {
            report(node, 'reexport')
          }
          return
        }

        const declaration = node.declaration

        if (declaration?.type === 'FunctionDeclaration') {
          if (!isAsyncFunctionNode(declaration)) {
            report(node, 'nonAsyncExport')
          }
          return
        }

        if (declaration?.type === 'VariableDeclaration') {
          for (const declarator of declaration.declarations) {
            if (!isAsyncFunctionNode(declarator.init)) {
              report(node, 'nonAsyncExport')
              return
            }
          }
          return
        }

        if (declaration?.type === 'TSEnumDeclaration' || declaration?.type === 'ClassDeclaration') {
          report(node, 'nonAsyncExport')
          return
        }

        if (declaration) {
          // Unrecognized value declaration (e.g. const enum already covered).
          if (
            declaration.type !== 'TSTypeAliasDeclaration' &&
            declaration.type !== 'TSInterfaceDeclaration'
          ) {
            report(node, 'nonAsyncExport')
          }
          return
        }

        for (const specifier of node.specifiers ?? []) {
          if (specifier.exportKind === 'type') continue
          if (specifier.type !== 'ExportSpecifier') {
            report(node, 'nonAsyncExport')
            continue
          }

          const localName = specifier.local?.name
          if (!localName || !programNode || !resolveLocalAsyncBinding(programNode, localName)) {
            report(specifier, 'nonAsyncExport')
          }
        }
      },
    }
  },
}

export const localRules = {
  rules: {
    'component-arrow-conventions': componentArrowConventions,
    'framework-default-export': frameworkDefaultExport,
    'no-component-default-export': noComponentDefaultExport,
    'use-server-async-exports': useServerAsyncExports,
  },
}
