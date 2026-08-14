import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const ignored = new Set(['.git', 'lib', 'node_modules', 'coverage'])
const textExtensions = new Set(['.js', '.json', '.md', '.mjs', '.ts', '.yaml', '.yml'])
const failures = []
const files = []

function inside(target) {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        if (!inside(realpathSync(path))) failures.push(`${relative(root, path)}: symlink leaves repository`)
      } catch (error) {
        failures.push(`${relative(root, path)}: broken symlink (${error.message})`)
      }
    } else if (entry.isDirectory()) walk(path)
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path)
  }
}

walk(root)
for (const path of files) {
  const rel = relative(root, path)
  const source = readFileSync(path, 'utf8')
  if (extname(path) === '.md' && /\.\.[/\\]/u.test(source)) {
    failures.push(`${rel}: documentation uses parent-directory navigation`)
  }
  if (['.js', '.mjs', '.ts'].includes(extname(path))) {
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/gu)) {
      if (!inside(resolve(dirname(path), match[1]))) failures.push(`${rel}: code path leaves repository: ${match[1]}`)
    }
  }
}

for (const required of ['package.json', 'cordis.patch.yml', 'README.md', 'README.zh.md', 'src/index.ts', 'src/invariant.ts']) {
  if (!existsSync(join(root, required))) failures.push(`missing required file ${required}`)
}
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
  for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
    if (/^(?:file|link|portal|workspace|git\+|https?):/iu.test(spec) || spec.startsWith('.') || isAbsolute(spec)) {
      failures.push(`package.json: ${field}.${name} uses non-registry spec ${spec}`)
    }
  }
}
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`self-contained repository verified (${files.length} text files)`)
