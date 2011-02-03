fs       = require "fs"
path     = require "path"
async    = require "async"
Logger   = require "./logger"
{mkdirp} = require "./util"

getFilenamesForHost = (host, domain) ->
  if host.slice(-domain.length - 1) is ".#{domain}"
    parts  = host.slice(0, -domain.length - 1).split "."
    length = parts.length
    for i in [0...length]
      parts.slice(i, length).join "."
  else
    []

module.exports = class Configuration
  constructor: (options = {}) ->
    @dstPort  = options.dstPort  ? 80
    @httpPort = options.httpPort ? 20559
    @dnsPort  = options.dnsPort  ? 20560
    @timeout  = options.timeout  ? 15 * 60 * 1000
    @workers  = options.workers  ? 2
    @domain   = options.domain   ? "test"
    @root     = options.root     ? path.join process.env.HOME, ".pow"
    @logRoot  = options.logRoot  ? path.join @root, ".log"
    @loggers  = {}

  getLogger: (name) ->
    @loggers[name] ||= new Logger path.join @logRoot, name + ".log"

  findApplicationRootForHost: (host, callback) ->
    @gatherApplicationRoots (err, roots) =>
      return callback err if err
      for file in getFilenamesForHost host, @domain
        if root = roots[file]
          return callback null, root
      callback null

  gatherApplicationRoots: (callback) ->
    roots = {}
    mkdirp @root, (err) =>
      return callback err if err
      fs.readdir @root, (err, files) =>
        return callback err if err
        async.forEach files, (file, next) =>
          root = path.join @root, file
          fs.lstat root, (err, stats) ->
            if stats?.isSymbolicLink()
              fs.realpath root, (err, resolvedPath) ->
                if err then next()
                else fs.lstat resolvedPath, (err, stats) ->
                  roots[file] = resolvedPath if stats?.isDirectory()
                  next()
            else if stats?.isDirectory()
              roots[file] = root
              next()
            else
              next()
        , (err) ->
          callback err, roots
