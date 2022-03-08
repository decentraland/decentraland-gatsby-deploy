#!/usr/bin/env node
const { createWriteStream } = require('fs')
const { resolve: resolvePath,  relative: relativePath } = require('path')
const { request } = require('https')
const { yellow } = require('colors/safe')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { Octokit } = require('@octokit/rest')
const { getUserAgent } = require('universal-user-agent')
const { exitWithError } = require('./utils')

const argv = yargs(hideBin(process.argv))
  .option('owner', {
    type: 'string',
    description: 'Owner of the repository',
    demandOption: true
  })
  .option('repo', {
    type: 'string',
    description: 'Repository name',
    demandOption: true
  })
  .option('release', {
    type: 'string',
    description: 'Release name',
    default: 'latest',
  })
  .option('--allow-pre-release', {
    type: 'boolean',
    description: 'Download the latest pre-release'
  })
  .option('ext', {
    type: 'string',
    description: 'Download release with this extension'
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file'
  })
  .argv

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined
})

Promise.resolve()
  .then(async () => {
    if (argv['allow-pre-release']) {
      const result = await octokit.repos.listReleases({
        owner: argv.owner,
        repo: argv.repo,
        per_page: 1
      })

      return result.data[0]
    }

    const latest = await octokit.repos.getLatestRelease({
      owner: argv.owner,
      repo: argv.repo,
    })

    return latest.data
  })
  .then(async (release) => {
    if (release.assets.length === 0) {
      throw new Error(`Release does not contain any asset`)
    }

    if (!argv.ext && release.assets.length !== 1) {
      throw new Error(`Multiple assets found, please use the --ext options to select one`)
    }

    const asset = argv.ext ? release.assets.find(asset => asset.name.endsWith(argv.ext)) : release.assets[0]
    if (!asset) {
      throw new Error(`Asset with extension "${argv.ext}" not found`)
    }

    const url = asset.url
    const headers = {
      'Accept': 'application/octet-stream',
      'User-Agent': `octokit-core.js/${Octokit.VERSION} ${getUserAgent()}`,
    }

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
    }

    const stream = await requestStream(url, { headers })
    return [ release, asset, stream ]
  })
  .then(async ([release, asset, stream]) => new Promise((resolve, reject) => {
    let size = 0
    const progressSize = 50
    const cwd = process.cwd()
    const filepath = resolvePath(cwd, argv.output || asset.name)
    console.log(`downloading`, yellow(`${argv.owner}/${argv.repo} ${release.name} (${asset.name})`), 'to', yellow(relativePath(cwd, filepath)))

    const file = createWriteStream(filepath)
    const contentLength = Number(stream.headers['content-length'])

    console.log()
    logProgress(size, contentLength, progressSize)
    const interval = setInterval(() => logProgress(size, contentLength, progressSize), 1000)

    stream
      .on('data', (chuck) => {
        size += chuck.length
        file.write(chuck)
      })
      .on('end', () => {
        logProgress(contentLength, contentLength, progressSize)
        clearInterval(interval)
        resolve()
      })
      .on('error', (err) => {
        clearInterval(interval)
        reject(err)
      })
  }))
  .then(async () => {
    console.log('Done!')
  })
  .catch(exitWithError)


async function requestStream(url, options) {
  return new Promise((resolve, reject) => {
    const req = request(url, options, res => {
      if (res.statusCode >= 400) {
        return reject(new Error(`[HttpError: ${res.statusCode}] ${url}`))
      } else if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location
        return resolve(requestStream(location, options))
      } else {
        return resolve(res)
      }
    })
    req.on('error', reject)
    req.end()
  })
}

function logProgress(current, total, size) {
  const pad = String(total).length
  const full = '\u2588'
  const shade = '\u2591'
  process.stdout.write('\u001b[2K\u001b[K\u001b[1A');
  const fulls = Math.floor((current / total) * size)
  const percentage = Math.floor((current / total) * 100)
  console.log(
    (' '.repeat(pad) + String(current)).slice(-pad),
    (full.repeat(fulls) + shade.repeat(size)).slice(0, size),
    total,
    percentage + '%'
  )
}