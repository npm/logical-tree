'use strict'

class LogicalTree {
  constructor (name, lockNode, address) {
    this.name = name
    this.version = lockNode.version
    this.address = address
    this.optional = !!lockNode.optional
    this.dev = !!lockNode.dev
    this.bundled = !!lockNode.bundled
    this.resolved = lockNode.resolved
    this.integrity = lockNode.integrity
    this.dependencies = new Map()
    this.pending = null
  }

  addDep (dep) {
    this.dependencies.set(dep.name, dep)
  }

  getDep (name) {
    return this.dependencies.get(name)
  }
}

module.exports = logicalTree
function logicalTree (pkg, pkgLock, opts) {
  const tree = new LogicalTree(pkg.name, pkg, null)
  const allDeps = new Map()
  Array.from(
    new Set(Object.keys(pkg.devDependencies || {})
    .concat(Object.keys(pkg.optionalDependencies || {}))
    .concat(Object.keys(pkg.dependencies || {})))
  ).forEach(name => {
    let dep = allDeps.get(name)
    if (!dep) {
      const depNode = (pkgLock.dependencies || {})[name]
      dep = new LogicalTree(name, depNode, name)
    }
    addChild(dep, tree, allDeps, pkgLock)
  })
  return tree
}

function addChild (dep, tree, allDeps, pkgLock) {
  tree.addDep(dep)
  allDeps.set(dep.address, dep)
  const addr = dep.address
  const lockNode = atAddr(pkgLock, addr)
  Object.keys(lockNode.requires || {}).forEach(name => {
    const tdepAddr = reqAddr(pkgLock, name, lockNode.requires[name], addr)
    let tdep = allDeps.get(tdepAddr)
    if (!tdep) {
      tdep = new LogicalTree(name, atAddr(pkgLock, tdepAddr), tdepAddr)
      addChild(tdep, dep, allDeps, pkgLock)
    } else {
      dep.addDep(tdep)
    }
  })
}

module.exports._reqAddr = reqAddr
function reqAddr (pkgLock, name, version, fromAddr) {
  const lockNode = atAddr(pkgLock, fromAddr)
  const child = (lockNode.dependencies || {})[name]
  if (child && child.version === version) {
    return `${fromAddr}:${name}`
  } else {
    const parts = fromAddr.split(':')
    while (parts.length) {
      parts.pop()
      const parent = atAddr(pkgLock, parts.join(':'))
      if (parent) {
        const child = (parent.dependencies || {})[name]
        if (child && child.version === version) {
          return `${parts.join(':')}${parts.length ? ':' : ''}${name}`
        }
      }
    }
  }
}

module.exports._atAddr = atAddr
function atAddr (pkgLock, addr) {
  if (!addr.length) { return pkgLock }
  const parts = addr.split(':')
  return parts.reduce((acc, next) => {
    return acc && (acc.dependencies || {})[next]
  }, pkgLock)
}
