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

export const localRules = {
  rules: {
    'component-arrow-conventions': componentArrowConventions,
    'framework-default-export': frameworkDefaultExport,
    'no-component-default-export': noComponentDefaultExport,
  },
}
