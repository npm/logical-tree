'use strict'

const test = require('tap').test

const logi = require('../index.js')

test('includes toplevel dependencies', t => {
  const pkg = {
    dependencies: {
      'a': '^1.0.0',
      'b': '^2.0.0'
    }
  }
  const pkgLock = {
    dependencies: {
      'a': {
        version: '1.0.1'
      },
      'b': {
        version: '2.0.2'
      }
    }
  }
  const logicalTree = logi(pkg, pkgLock)
  t.deepEqual(
    logicalTree.requiredBy,
    new Set(),
    'toplevel is not required'
  )

  t.ok(logicalTree.getDep('a'), 'dep a is there')
  t.equal(
    logicalTree.getDep('a').version,
    '1.0.1',
    'dep b has a version'
  )
  t.deepEqual(
    logicalTree.getDep('a').requiredBy,
    new Set([logicalTree]),
    'a is required by the root'
  )

  t.ok(logicalTree.getDep('b'), 'dep b is there')
  t.equal(
    logicalTree.getDep('b').version,
    '2.0.2',
    'dep b has a version'
  )
  t.deepEqual(
    logicalTree.getDep('b').requiredBy,
    new Set([logicalTree]),
    'dep b is required by root'
  )
  t.done()
})

test('includes transitive dependencies', t => {
  const pkg = {
    dependencies: {
      'a': '^1.0.0',
      'b': '^2.0.0'
    }
  }
  const pkgLock = {
    dependencies: {
      'a': {
        version: '1.0.1',
        requires: {
          b: '2.0.2',
          c: '3.0.3'
        },
        dependencies: {
          'c': {
            version: '3.0.3',
            requires: {
              b: '2.0.2'
            }
          }
        }
      },
      'b': {
        version: '2.0.2'
      }
    }
  }
  const logicalTree = logi(pkg, pkgLock)
  const depA = logicalTree.getDep('a')
  const depB = logicalTree.getDep('b')
  const depC = logicalTree.getDep('a').getDep('c')
  t.ok(logicalTree.getDep('a').getDep('b'), 'flattened transitive dep')
  t.ok(logicalTree.getDep('a').getDep('c'), 'nested transitive dep')
  t.equal(
    depA.getDep('c').getDep('b'),
    depB,
    'matching deps have object identity'
  )
  t.deepEqual(
    depA.requiredBy,
    new Set([logicalTree]),
    'depA only required by root'
  )
  t.deepEqual(
    depB.requiredBy,
    new Set([logicalTree, depA, depC]),
    'depB required by root, A, and C'
  )
  t.deepEqual(
    depC.requiredBy,
    new Set([depA]),
    'depC is only required by A'
  )
  t.done()
})

test('supports dependency cycles', t => {
  const pkg = {
    dependencies: {
      'a': '^1.0.0',
      'b': '^2.0.0'
    }
  }
  const pkgLock = {
    dependencies: {
      'a': {
        version: '1.0.1',
        requires: {
          b: '2.0.2',
          c: '3.0.3'
        },
        dependencies: {
          'c': {
            version: '3.0.3',
            requires: {
              b: '2.0.2'
            }
          }
        }
      },
      'b': {
        version: '2.0.2',
        requires: {
          'a': '1.0.1'
        }
      }
    }
  }
  const logicalTree = logi(pkg, pkgLock)
  const depA = logicalTree.getDep('a')
  const depB = logicalTree.getDep('b')
  const depC = depA.getDep('c')
  t.equal(
    depA.getDep('b').getDep('a'),
    depA,
    'cycle resolved successfully'
  )
  t.deepEqual(
    depA.requiredBy,
    new Set([logicalTree, depB]),
    'depA is requiredBy on depB'
  )
  t.deepEqual(
    depB.requiredBy,
    new Set([logicalTree, depA, depC]),
    'depB is requiredBy on depA'
  )
  t.done()
})

test('UNIT: atAddr', t => {
  const pkgLock = {
    dependencies: {
      'a': {
        version: '1.0.1',
        requires: {
          b: '2.0.2',
          c: '3.0.3'
        },
        dependencies: {
          'c': {
            version: '3.0.3',
            requires: {
              b: '2.0.2'
            }
          }
        }
      },
      'b': {
        version: '2.0.2'
      }
    }
  }
  t.deepEqual(logi._atAddr(pkgLock, 'b'), {
    version: '2.0.2'
  }, 'found toplevel dep')
  t.deepEqual(logi._atAddr(pkgLock, 'a:c'), {
    version: '3.0.3',
    requires: {
      b: '2.0.2'
    }
  }, 'found nested dep')
  t.done()
})

test('UNIT: reqAddr')
