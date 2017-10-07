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
  t.ok(logicalTree.getDep('a'), 'dep a is there')
  t.equal(
    logicalTree.getDep('a').version,
    '1.0.1',
    'dep b has a version'
  )
  t.ok(logicalTree.getDep('b'), 'dep b is there')
  t.equal(
    logicalTree.getDep('b').version,
    '2.0.2',
    'dep b has a version'
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
  t.ok(logicalTree.getDep('a').getDep('b'), 'flattened transitive dep')
  t.ok(logicalTree.getDep('a').getDep('c'), 'nested transitive dep')
  t.equal(
    logicalTree.getDep('a').getDep('c').getDep('b'),
    logicalTree.getDep('b'),
    'matching deps have object identity'
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
        version: '2.0.2',
        requires: {
          'a': '1.0.1'
        }
      }
    }
  }
  const logicalTree = logi(pkg, pkgLock)
  t.equal(
    logicalTree.getDep('a').getDep('b').getDep('a'),
    logicalTree.getDep('a'),
    'cycle resolved successfully'
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
