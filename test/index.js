'use strict'

const BB = require('bluebird')

const path = require('path')
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

test('addDep', t => {
  const tree = logi.node('foo')
  const dep = logi.node('bar')
  t.equal(tree.addDep(dep), tree, 'returns the tree')
  t.deepEqual(
    tree.dependencies,
    new Map([[dep.name, dep]]),
    'dep added to dependencies'
  )
  t.deepEqual(dep.requiredBy, new Set([tree]), 'requiredBy updated for dep')
  t.deepEqual(dep.dependencies, new Map(), 'nothing in dep.dependencies')
  t.deepEqual(tree.requiredBy, new Set(), 'nothing in tree.requiredBy')
  t.done()
})

test('delDep', t => {
  const tree = logi.node('foo')
  const dep = logi.node('bar')
  tree.addDep(dep)
  t.equal(tree.delDep(dep), tree, 'returns the tree')
  t.deepEqual(tree.dependencies, new Map(), 'nothing in tree.dependencies')
  t.deepEqual(dep.requiredBy, new Set(), 'nothing in dep.requiredBy')
  t.done()
})

test('getDep', t => {
  const tree = logi.node('foo')
  const dep = logi.node('bar')
  tree.addDep(dep)
  t.equal(tree.getDep('bar'), dep, 'got dep named bar')
  t.equal(tree.getDep('baz'), undefined, 'nothing if no dep w/ that name')
  t.done()
})

test('path', t => {
  const tree = logi.node('foo')
  .addDep(logi.node('bar', 'bar'))
  .addDep(logi.node('baz', 'baz:quux:hey'))
  .addDep(logi.node('quux', 'quux:@meh/x:oh'))
  t.equal(tree.path(), '', 'root node has no address by default')
  t.equal(
    tree.path(path.join('foo', 'bar')),
    path.join('foo', 'bar'),
    'root node path uses prefix directly if passed in'
  )
  t.equal(
    tree.getDep('bar').path(),
    path.join('node_modules', 'bar'),
    'first-level dep uses own name with n_m prepended as path'
  )
  t.equal(
    tree.getDep('bar').path(path.join('foo', 'bar')),
    path.join('foo', 'bar', 'node_modules', 'bar'),
    'prefix and node_modules prepended to first-level dep'
  )
  t.equal(
    tree.getDep('baz').path(),
    path.join(
      'node_modules', 'baz', 'node_modules', 'quux', 'node_modules', 'hey'
    ),
    'paths include node_modules for nested deps'
  )
  t.equal(
    tree.getDep('quux').path(),
    path.join(
      'node_modules', 'quux', 'node_modules', '@meh', 'x', 'node_modules', 'oh'
    ),
    'supports scoped dependencies'
  )
  t.done()
})

test('logicalTree.node', t => {
  const tree = logi.node('hey')
  t.similar(tree, {
    name: 'hey',
    version: undefined,
    address: '',
    optional: false,
    dev: false,
    bundled: false,
    resolved: undefined,
    integrity: undefined,
    dependencies: new Map(),
    requiredBy: new Set()
  }, 'default construction')
  t.equal(tree.isRoot, true, 'detected as root')
  const dep = logi.node('there', 'i:am:here', {
    version: '1.1.1',
    optional: true,
    dev: true,
    bundled: true,
    resolved: 'here/it/is',
    integrity: 'sha1-deadbeef'
  })
  t.similar(dep, {
    name: 'there',
    address: 'i:am:here',
    version: '1.1.1',
    optional: true,
    dev: true,
    bundled: true,
    resolved: 'here/it/is',
    integrity: 'sha1-deadbeef'
  }, 'accepts address and options')
  t.done()
})

test('hasCycle', t => {
  const tree = logi.node('root')
  const dep1 = logi.node('dep1')
  const dep2 = logi.node('dep2')
  const dep3 = logi.node('dep3')
  tree.addDep(dep1.addDep(dep2))
  t.equal(tree.hasCycle(), false, 'no cycle found for tree')
  t.equal(dep1.hasCycle(), false, 'no cycle found for dep1')
  t.equal(dep2.hasCycle(), false, 'no cycle found for dep2')
  dep2.addDep(dep1)
  t.equal(tree.hasCycle(), false, 'no cycle found for tree')
  t.equal(dep1.hasCycle(), true, 'dep1 has a cycle')
  t.equal(dep2.hasCycle(), true, 'dep2 has a cycle')
  dep2.delDep(dep1).addDep(dep3)
  dep3.addDep(dep1)
  t.equal(tree.hasCycle(), false, 'no cycle found for tree')
  t.equal(dep1.hasCycle(), true, 'dep1 has transitive cycle')
  t.equal(dep2.hasCycle(), true, 'dep2 has transitive cycle')
  t.equal(dep3.hasCycle(), true, 'dep3 has transitive cycle')
  dep3.addDep(tree)
  dep1.addDep(tree)
  tree.addDep(dep2)
  t.equal(tree.hasCycle(), true, 'complex cycle resolved successfully')
  const selfRef = logi.node('selfRef')
  selfRef.addDep(selfRef)
  t.equal(selfRef.hasCycle(), true, 'self-referencing dep handled')
  t.done()
})

test('forEachAsync', t => {
  const tree = logi.node('root')
  const dep1 = logi.node('dep1')
  const dep2 = logi.node('dep2')
  const dep3 = logi.node('dep3')

  tree.addDep(dep1.addDep(dep2.addDep(dep3)))
  let found = []
  return tree.forEachAsync((dep, next) => {
    return Promise.resolve(found.push(dep))
  })
  .then(() => {
    t.deepEqual(found, [tree], 'no children unless next is used')
    found = []
    return tree.forEachAsync((dep, next) => {
      return next().then(() => found.push(dep))
    })
  })
  .then(() => {
    t.deepEqual(found, [dep3, dep2, dep1, tree], 'next() iterates down')
    found = []
    return tree.forEachAsync((dep, next) => {
      found.push(dep)
      return next()
    })
  })
  .then(() => {
    t.deepEqual(found, [tree, dep1, dep2, dep3], 'next() can be called after')
    found = []
    const mapFn = (dep, next) => {
      found.push(dep)
      return next()
    }
    let usedFakePromise = false
    const fakeP = {
      map (arr, fn) {
        usedFakePromise = true
        return BB.map(arr, fn)
      },
      resolve: BB.resolve
    }
    return tree.forEachAsync(mapFn, {Promise: fakeP})
    .then(() => {
      t.deepEqual(found, [tree, dep1, dep2, dep3], 'next() can be called after')
      t.ok(usedFakePromise, 'used fake promise')
    })
  })
  .then(() => {
    found = []
    dep3.addDep(tree)
    return tree.forEachAsync((dep, next) => {
      found.push(dep)
      return next()
    })
  })
  .then(() => {
    t.deepEqual(found, [tree, dep1, dep2, dep3], 'handled cycle correctly')
  })
})

test('forEach', t => {
  const tree = logi.node('root')
  const dep1 = logi.node('dep1')
  const dep2 = logi.node('dep2')
  const dep3 = logi.node('dep3')

  tree.addDep(dep1.addDep(dep2.addDep(dep3)))
  let found = []
  tree.forEach((dep, next) => {
    return found.push(dep)
  })
  t.deepEqual(found, [tree], 'no children unless next is used')

  found = []
  tree.forEach((dep, next) => {
    next()
    found.push(dep)
  })
  t.deepEqual(found, [dep3, dep2, dep1, tree], 'next() iterates down')

  found = []
  tree.forEach((dep, next) => {
    found.push(dep)
    next()
  })
  t.deepEqual(found, [tree, dep1, dep2, dep3], 'next() can be called after')

  found = []
  dep3.addDep(tree)
  tree.forEach((dep, next) => {
    found.push(dep)
    next()
  })
  t.deepEqual(found, [tree, dep1, dep2, dep3], 'handles cycles correctly')

  t.done()
})

test('atAddr', t => {
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
