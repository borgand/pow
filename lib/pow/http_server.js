(function() {
  var HttpServer, connect, fs, getHost, join, nack, sys;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  };
  fs = require("fs");
  join = require("path").join;
  sys = require("sys");
  connect = require("connect");
  nack = require("nack");
  getHost = function(req) {
    return req.headers.host.replace(/:.*/, "");
  };
  module.exports = HttpServer = (function() {
    __extends(HttpServer, connect.Server);
    function HttpServer(configuration) {
      this.configuration = configuration;
      this.handleNonexistentDomain = __bind(this.handleNonexistentDomain, this);;
      this.closeApplications = __bind(this.closeApplications, this);;
      this.handleRequest = __bind(this.handleRequest, this);;
      HttpServer.__super__.constructor.call(this, [
        this.handleRequest, connect.errorHandler({
          showStack: true
        }), this.handleNonexistentDomain
      ]);
      this.handlers = {};
      this.on("close", this.closeApplications);
    }
    HttpServer.prototype.getHandlerForHost = function(host, callback) {
      return this.configuration.findApplicationRootForHost(host, __bind(function(err, root) {
        if (err) {
          return callback(err);
        }
        return callback(null, this.getHandlerForRoot(root));
      }, this));
    };
    HttpServer.prototype.getHandlerForRoot = function(root) {
      var _base;
      if (!root) {
        return;
      }
      return (_base = this.handlers)[root] || (_base[root] = {
        root: root,
        app: this.createApplication(join(root, "config.ru"))
      });
    };
    HttpServer.prototype.createApplication = function(configurationPath) {
      var app;
      app = nack.createServer(configurationPath, {
        idle: this.configuration.timeout
      });
      sys.pump(app.pool.stdout, process.stdout);
      sys.pump(app.pool.stderr, process.stdout);
      return app;
    };
    HttpServer.prototype.handleRequest = function(req, res, next) {
      var host, pause;
      pause = connect.utils.pause(req);
      host = getHost(req);
      return this.getHandlerForHost(host, __bind(function(err, handler) {
        if (!handler) {
          return next(err);
        }
        return this.restartIfNecessary(handler, __bind(function() {
          pause.end();
          if (err) {
            return next(err);
          }
          req.proxyMetaVariables = {
            SERVER_PORT: this.configuration.dstPort.toString()
          };
          handler.app.handle(req, res, next);
          return pause.resume();
        }, this));
      }, this));
    };
    HttpServer.prototype.closeApplications = function() {
      var app, root, _ref, _results;
      _ref = this.handlers;
      _results = [];
      for (root in _ref) {
        app = _ref[root].app;
        _results.push(app.pool.quit());
      }
      return _results;
    };
    HttpServer.prototype.restartIfNecessary = function(_arg, callback) {
      var app, root;
      root = _arg.root, app = _arg.app;
      return fs.unlink(join(root, "tmp/restart.txt"), function(err) {
        if (err) {
          return callback();
        } else {
          app.pool.onNext("exit", callback);
          return app.pool.quit();
        }
      });
    };
    HttpServer.prototype.handleNonexistentDomain = function(req, res, next) {
      var host, name, path;
      host = getHost(req);
      name = host.slice(0, host.length - this.configuration.domain.length - 1);
      path = join(this.configuration.root, name);
      res.writeHead(503, {
        "Content-Type": "text/html; charset=utf8"
      });
      return res.end("<!doctype html>\n<html>\n<head>\n  <style>\n    body {\n      margin: 0;\n      padding: 0;\n    }\n    h1, h2 {\n      margin: 0;\n      padding: 15px 30px;\n      font-family: Helvetica, sans-serif;\n    }\n    h1 {\n      font-size: 36px;\n      background: #eeedea;\n      color: #000;\n      border-bottom: 1px solid #999090;\n    }\n    h2 {\n      font-size: 18px;\n      font-weight: normal;\n    }\n  </style>\n</head>\n<body>\n  <h1>This domain hasn&rsquo;t been set up yet.</h1>\n  <h2>Symlink your application to <code>" + path + "</code> first.</h2>\n</body>\n</html>");
    };
    return HttpServer;
  })();
}).call(this);