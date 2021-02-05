const { green, red, yellow } = require('colors/safe')
const project = require('../package.json')
const dependency = require('../node_modules/dcl-ops-lib/package.json')
const libs = Object.entries(dependency.dependencies)
const ok = []
const missing = []

for (const [lib, version] of libs) {
  if (lib.startsWith('@pulumi/')) {
    if (project.dependencies[lib] === version) {
      ok.push([lib, version])
    } else {
      missing.push([lib, version])
    }
  }
}

console.log()
console.log(green(`Checking ${dependency.name}@${dependency.version} dependencies:`))
console.log()
for (const [lib, version] of ok) {
  console.log(green(`    ✓ ${lib}@${version}`))
}

for (const [lib, version] of missing) {
  console.log(green(`    ✗ ${lib}@${version}`))
}

console.log()

if (missing.length > 0) {
  const installs = missing
   .map(pkg => pkg.join('@'))
   .join(' \\\n                ')

  console.log(yellow(`Please run the following command to update:`))
  console.log()
  console.log(yellow(`    npm install ${installs}`))
  console.log(yellow(`    npm install --save-exact ${dependency.name}@${dependency.version}`))
  console.log()
}
