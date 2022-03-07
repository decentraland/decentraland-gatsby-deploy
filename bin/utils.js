const { red, grey } = require('colors/safe')

exports.exitWithError = (err) => {
  const newLinePosition = err.stack.indexOf(`\n`)
  console.log()
  console.log(red(err.stack.slice(0, newLinePosition)))
  console.log(grey(err.stack.slice(newLinePosition + 1)))
  console.log()
  process.exit(1)
}