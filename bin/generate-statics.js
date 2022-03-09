#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')
const { promisify } = require('util')
const glob = require('glob')
const slug = require('slug')
const sharp = require('sharp')
const pMap = require('p-map')
const { optimize } = require('svgo')
const bytes = require('superbytes')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { yellow, green, red } = require('colors/safe')
const { exitWithError } = require('./utils')

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)

const argv = yargs(hideBin(process.argv))
  .option('source-dir', {
    alias: 's',
    type: 'string',
    description: 'base directory of the files',
    default: '.'
  })
  .option('files', {
    type: 'string',
    array: true,
    description: 'glob of the files',
    demandOption: true
  })
  .option('output-dir', {
    alias: 'o',
    description: 'output directory by default use the same sa the source-dir'
  })
  .option('webp', {
    type: 'boolean',
    description: 'create webp version of all jpg and png files'
  })
  .option('source-map', {
    alias: 'm',
    type: 'string',
    description: 'create a file that maps source files to their optimized version'
  })
  .option('source-map-format', {
    alias: 'f',
    type: 'string',
    choices: [ 'raw', 'json', 'yml', 'yaml' ],
    description: 'source map format'
  })
  .argv

function createFileMapper(outputStream, format) {
  let isFirstLine = true
  return (source, destination) => {
    if (!outputStream) {
      return
    }

    switch (format) {
      case 'json':
        if (isFirstLine) {
          isFirstLine = false
        } else {
          outputStream.write(`,\n`)
        }

        outputStream.write(`  "${source}":"${destination}"`)
        break;
      case 'yml':
      case 'yaml':
        outputStream.write(`${source}: '${destination}'\n`)
        break;
      default:
        outputStream.write(`${source} => ${destination}\n`)
    }
  }
}

function createFileLogger() {
  return (source, sourceSize, destination, destinationSize) => {
    const compression = Number((100 - Number(((destinationSize / sourceSize) * 100))).toFixed(2))
    console.log(
      source,
      `(${bytes(sourceSize)})`,
      '=>',
      yellow(destination),
      sourceSize === destinationSize ?
        green(`(${bytes(destinationSize)})`):
        green(`(${bytes(destinationSize)}, ${compression < 0 ? red(-compression + '%') : green(-compression + '%')})`)
    )
  }
}

function createHasher(algo) {
  return (buffer) => createHash(algo).update(buffer).digest('hex')
}

function createDir() {
  const destinationDirMap = new Set([])
  return async (destinationDir) => {
    if (!destinationDirMap.has(destinationDir)) {
      await mkdir(destinationDir, { recursive: true })
      destinationDirMap.add(destinationDir)
    }
  }
}

Promise.resolve()
  .then(async () => {
    const sourceDir = path.resolve(process.cwd(), argv['source-dir'])
    const destinationDir = argv['output-dir'] ? path.resolve(process.cwd(), argv['output-dir']) : sourceDir
    const mapStream = argv['source-map'] && fs.createWriteStream(path.resolve(process.cwd(), argv['source-map']))
    const mapFormat = argv['source-map-format'] || path.extname(argv['source-map'] || '').slice(1)
    const logger = createFileLogger()
    const mapper = createFileMapper(mapStream, mapFormat)
    const hasher = createHasher('md5')
    const mkdir = createDir()

    await mkdir(destinationDir)

    if (mapFormat === 'json') {
      mapStream.write('{\n')
    }

    for (const expression of argv.files) {
      const files = glob.sync(expression, { cwd: sourceDir })
      await pMap(files, async (source) => {
        const sourcePath = path.resolve(sourceDir, source)
        const sourceBuffer = await readFile(sourcePath)
        const sourceExtension = path.extname(source)

        let destinationExtension = sourceExtension;
        let destinationBuffer = sourceBuffer;
        let destinationTypeDir = path.resolve(destinationDir, 'static/other');

        switch (sourceExtension) {
          case '.svg':
            const destinationSVG = optimize(sourceBuffer)
            destinationBuffer = Buffer.from(destinationSVG.data)
            destinationTypeDir = path.resolve(destinationDir, 'static/images')
            break

          case '.webp':
            destinationBuffer = await sharp(sourceBuffer).webp({ }).toBuffer()
            destinationTypeDir = path.resolve(destinationDir, 'static/images')

            if (sourceBuffer.length <= destinationBuffer.length) {
              destinationBuffer = sourceBuffer
            }

          case '.jpg':
          case '.jpeg':
            destinationBuffer = await sharp(sourceBuffer).jpeg({ mozjpeg: true }).toBuffer()
            destinationTypeDir = path.resolve(destinationDir, 'static/images')

            if (sourceBuffer.length <= destinationBuffer.length) {
              destinationBuffer = sourceBuffer
            }
            break

          case '.png':
            const destinationPNGSharp = sharp(sourceBuffer)
            const destinationPNGMetadata = await destinationPNGSharp.metadata()
            destinationTypeDir = path.resolve(destinationDir, 'static/images')

            if (!destinationPNGMetadata.hasAlpha) {
              destinationBuffer = await destinationPNGSharp.jpeg({ mozjpeg: true }).toBuffer()
              destinationExtension = '.jpg'
            }

            if (destinationPNGMetadata.hasAlpha || sourceBuffer.length <= destinationBuffer.length) {
              destinationBuffer = await destinationPNGSharp.png({}).toBuffer()
            }

            if (sourceBuffer.length <= destinationBuffer.length) {
              destinationBuffer = sourceBuffer
              destinationExtension = sourceExtension
            }
            break
        }

        await mkdir(destinationTypeDir)
        const destinationHash = hasher(destinationBuffer)
        const destinationName = slug(path.basename(sourcePath, sourceExtension))
        const destination = path.resolve(destinationTypeDir, destinationName + '-' + destinationHash + destinationExtension)

        await writeFile(destination, destinationBuffer)

        if (!!argv.webp && ['.jpg', '.jpeg', '.png'].includes(sourceExtension)) {
          const webpBuffer = await sharp(sourceBuffer).webp({ }).toBuffer()
          const webpDestination = path.resolve(destinationTypeDir, destinationName + '-' + destinationHash + '.webp')

          if (webpBuffer.length <= sourceBuffer.length) {
            await writeFile(webpDestination, webpBuffer)
            await logger(source, sourceBuffer.length, path.relative(sourceDir, webpDestination), webpBuffer.length)
          }
        }

        await mapper(source, path.relative(destinationDir, destination))
        await logger(source, sourceBuffer.length, path.relative(sourceDir, destination), destinationBuffer.length)

        return
      }, { concurrency: 10 })
    }

    if (mapFormat === 'json') {
      mapStream.write('\n}\n')
    }
  })
  .catch(exitWithError)
