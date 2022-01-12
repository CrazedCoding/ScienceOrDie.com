const opts = require('./config.json')
const fs = require('fs');
const express = require('express');
const session = require('express-session')
const application = express()
const cors = require('cors');
const ws = require('ws')
const ssl = opts["ssl"] && opts["ssl"].key && opts["ssl"].cert
const factory = ssl ? require('https') : require('http');
const { render, render_captcha } = require('./render.js')

opts.debug = true; //TODO: Delete later

opts["ssl"] = ssl ? {
  "key": fs.readFileSync(opts["ssl"].key),
  "cert": fs.readFileSync(opts["ssl"].cert),
} : opts["ssl"];

if (!opts["ssl"]) {
  console.warn("No ssl set. Please run `node configure.js`!")
}

opts.maxUpload = "5mb"
opts.cookieLifeTime = 60 * 30 // Seconds

// List of HTML entities for escaping.
var htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

function fetchFeatured() {
  const algorithms = []
  const folders = fs.readdirSync('./www/share/')
  for (const folder_name of folders) {
    if (!fs.lstatSync('./www/share/' + folder_name).isDirectory()) continue
    const files = fs.readdirSync('./www/share/' + folder_name)
    for (const file of files) {
      if (!fs.lstatSync('./www/share/' + folder_name + '/' + file).isFile() || !file.endsWith('json')) continue
      const algorithm = JSON.parse(fs.readFileSync('./www/share/' + folder_name + '/' + file))
      if (algorithm.featured) algorithms.push({ algorithm, path: folder_name })
    }
  }
  return algorithms
}
function fetchPublic() {
  const algorithms = []
  const folders = fs.readdirSync('./www/share/')
  for (const folder_name of folders) {
    if (!fs.lstatSync('./www/share/' + folder_name).isDirectory()) continue
    const files = fs.readdirSync('./www/share/' + folder_name)
    for (const file of files) {
      if (!fs.lstatSync('./www/share/' + folder_name + '/' + file).isFile() || !file.endsWith('json')) continue
      const algorithm = JSON.parse(fs.readFileSync('./www/share/' + folder_name + '/' + file))
      algorithms.push({ algorithm, path: folder_name })
    }
  }
  return algorithms
}

const { Readable } = require('stream');

class BufferStream extends Readable {
  constructor(buffer, opts) {
    super(opts);
    this.buffer = buffer;
  }
}

function bufferToStream(buffer, opts = {}) {
  return new BufferStream(buffer, opts);
}

// Streaming chunk
function streamBufferChunked(buffer, req, res) {
  let chunkSize = buffer.length;
  let range = (req.headers.range) ? req.headers.range.replace(/bytes=/, "").split("-") : [];

  range[0] = range[0] ? parseInt(range[0], 10) : 0;
  range[1] = range[1] ? parseInt(range[1], 10) : range[0] + chunkSize;
  if (range[1] > buffer.length - 1) {
    range[1] = buffer.length - 1;
  }
  range = { start: range[0], end: range[1] };

  res.writeHead(206, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': 0,
    'Accept-Ranges': 'bytes',
    'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + buffer.length,
    'Content-Length': range.end - range.start + 1,
  }).write(buffer.subarray(range.start, range.end + 1));
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

const router = express.Router();

router.all('/edit/:algorithm/', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    let safe_name = req.params.algorithm.toLowerCase().replace(/[\W_]+/g, "_");
    safe_name = safe_name.substring(0, Math.min(32, safe_name.length))
    const safe_path = safe_name + '/'
    const files = fs.readdirSync('./www/share/' + safe_path)
    const json_file = files.filter((file) => {
      return file.endsWith('.json')
    })
    const algorithm = JSON.parse(fs.readFileSync('./www/share/' + safe_path + json_file))
    // algorithm.files = algorithm.files.map((file)=>{file.data = ''; return file})

    if (!algorithm.featured &&
      (!req.session.accept_risk || (new Date().getTime() - req.session.accept_risk) / 1E3 > opts.cookieLifeTime)) {
      res.redirect('/warning/?url=/edit/' + req.params.algorithm + '/')
      res.end()
    }
    else {
      res.write(render({path:'./www/edit.html', algorithm, safe_path, opts}))
      res.end()
    }
  } catch (e) {
    console.log(e)
    next()
  }
});
router.all('/edit', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    res.redirect('/edit/default/')
  } catch (e) {
    console.log(e)
    next()
  }
});
router.all('/random', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    const featured = fetchFeatured()
    featured.sort((a, b) => new Date(b.algorithm.created).getTime() - new Date(a.algorithm.created).getTime())
    res.redirect('/live/' + featured[Math.floor(Math.random() * (featured.length - 1))].path + '/')
  } catch (e) {
    console.log(e)
    next()
  }
});
router.get('/live/:algorithm/', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    let safe_name = req.params.algorithm.toLowerCase().replace(/[\W_]+/g, "_");
    safe_name = safe_name.substring(0, Math.min(32, safe_name.length))
    const safe_path = safe_name + '/'
    const files = fs.readdirSync('./www/share/' + safe_path)
    const json_file = files.filter((file) => {
      return file.endsWith('.json')
    })
    const relative_path = './www/share/' + safe_path + json_file
    const algorithm = JSON.parse(fs.readFileSync(relative_path))

    if (!algorithm.featured &&
      (!req.session.accept_risk || (new Date().getTime() - req.session.accept_risk) / 1E3 > opts.cookieLifeTime)) {
      res.redirect('/warning/?url=/live/' + req.params.algorithm + '/')
      res.end()
    }
    else {
      algorithm.views += 1;
      fs.writeFileSync(relative_path, JSON.stringify(algorithm, null, 2))
      // algorithm.files = algorithm.files.map((file)=>{file.data = ''; return file})
      res.write(render({path:'./www/live.html', algorithm, safe_path, opts}))
      res.end()
    }
  } catch (e) {
    console.log(e)
    next()
  }
});
router.get('/live/:algorithm/:resource', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    let safe_name = req.params.algorithm.toLowerCase().replace(/[\W_]+/g, "_");
    safe_name = safe_name.substring(0, Math.min(32, safe_name.length))
    const resource_name = req.params.resource
    const safe_path = safe_name + '/'
    const files = fs.readdirSync('./www/share/' + safe_path)
    const json_file = files.filter((file) => {
      return file.endsWith('.json')
    })
    const file_path = './www/share/' + safe_path + json_file;
    const algorithm = JSON.parse(fs.readFileSync(file_path))
    if (!algorithm) next()


    if (!algorithm.featured &&
      (!req.session.accept_risk || (new Date().getTime() - req.session.accept_risk) / 1E3 > opts.cookieLifeTime)) {
      res.redirect('/warning/?url=/live/' + req.params.algorithm + '/' + req.params.resource)
      res.end()
    }
    else {
      const resource = algorithm.files.filter((file) => {
        return file.name === resource_name
      })[0]

      res.type(resource.name)
      streamBufferChunked(Buffer.from(resource.data, 'base64'), req, res)
    }
  } catch (e) {
    console.log(e)
    next()
  }
});
router.use('/test.html', express.static('www/test.html'))
router.use('/js', express.static('www/js'))
router.use('/img', express.static('www/img'))

router.get('/live', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    res.sendStatus(404);
  } catch (e) {
    console.log(e)
    next()
  }
});

router.get('/captcha.png', function (req, res, next) {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    const captcha = render_captcha()
    const image = captcha.image
    req.session.captcha_answer = captcha.answer+""
    res.type('image/png')
    res.send(image);
  } catch (e) {
    console.log(e)
    next()
  }
});

router.get('/', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    res.write(render({path:'./www/home.html', algorithm_list:fetchFeatured(), url:req.url, opts}))
    res.end()
  } catch (e) {
    console.log(e)
    next()
  }
});
router.get('/featured/:sort/:page', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    res.write(render({path:'./www/home.html', algorithm_list:fetchFeatured(), url:req.url, opts}))
    res.end()
  } catch (e) {
    console.log(e)
    next()
  }
});
router.get('/latest/:sort/:page', (req, res, next) => {
  try {
    if ((!req.session.accept_risk || (new Date().getTime() - req.session.accept_risk) / 1E3 > opts.cookieLifeTime)) {
      res.redirect('/warning/?url=/latest/'+req.params.sort+"/"+req.params.page)
      res.end()
    }
    else {
      res.write(render({path:'./www/home.html', algorithm_list:fetchPublic(), url:req.url, opts}))
      res.end()
    }
  } catch (e) {
    console.log(e)
    next()
  }
});
router.all('/warning', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    res.write(render({path:'./www/warning.html', opts}))
    res.end()
  } catch (e) {
    console.log(e)
    next()
  }
})
router.all('/warning/', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    else {
      res.status(404).send("You must provide a key to accept the risk.")
      res.end()
    }
  } catch (e) {
    console.log(e)
    next()
  }
})
router.all('/warning/:hash', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    if (req.params.hash === req.session.captcha_answer) {
      req.session.accept_risk = new Date().getTime()
      res.redirect('/')
      res.end()
    }
    else {
      res.status(404).send("Wrong key provided.")
    }
  } catch (e) {
    console.log(e)
    next()
  }
});
router.post('/share/', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    res.status(404).send("You must provide a key to share algorithms.")
  } catch (e) {
    console.log(e)
    next()
  }
})
router.post('/share/:hash', (req, res, next) => {
  try {
    if (opts.debug) console.log(req.socket.remoteAddress, new Date(), req.url);
    if (req.params.hash === req.session.captcha_answer) {
      req.session.accept_risk = new Date().getTime()
      req.body.created = new Date() + ""
      req.body.views = 0
      req.body.author = ""+req.socket.remoteAddress
      req.body.featured = false;
      const readable = JSON.stringify(req.body, null, 2);
      console.log(new Date() + " IP address " + req.socket.remoteAddress + " uploaded algorithm of size " + Math.floor(readable.length / 1024 * 10) / 10. + "kb named \"" + req.body.name + "\"")

      let safe_name = req.body.name.toLowerCase().replace(/[\W_]+/g, "_");//Make name lower-case and replace non-alphanumeric with underscores
      safe_name = safe_name.substring(0, Math.min(32, safe_name.length))
      const temp_name = req.body.public ? safe_name : ("" + Math.floor(Math.random(new Date().getTime()) * 1E12))
      let folder_name = 'www/share/' + temp_name;

      if (fs.existsSync(folder_name)) {
        res.status(404).send("Upload already exists.")
        return;
      }

      fs.mkdirSync(folder_name)

      fs.writeFileSync(folder_name + '/' + safe_name + '.json', readable);

      const remote_path = temp_name + '/'
      res.send(JSON.stringify({ saved_as: remote_path }))
      res.end()
    }
    else {
      res.status(404).send("Wrong key provided.")
    }
  } catch (e) {
    console.log(e)
    next()
  }
});

router.use('*', (req, res, next) => {
  res.sendStatus(404);
});

const json = express.json({ limit: opts.maxUpload }) // Used to parse JSON bodies
const url = express.urlencoded({ limit: opts.maxUpload, extended: true }) //Parse URL-encoded bodies

application.use(cors({
  origin: '*'
}));

if(ssl) {
  application.all('*', ensureSecure);
  require('http').createServer(application).listen(80)
}

application.use(session({ secret: '' + Math.random(new Date().getTime()), resave: false, saveUninitialized: false, cookie: { maxAge: opts.cookieLifeTime * 1E3 } }))
application.use((req, res, next) => { try { json(req, res, next); } catch (e) { console.log('JSON Error!', e) } });
application.use((req, res, next) => { try { url(req, res, next); } catch (e) { console.log('URL Error!', e) } });
application.use('/', router);
application.use(function (err, req, res, next) {
  console.error(err.message)
  res.status(500).send('Something broke! Your upload was probably too large. Try uploading something smaller.')
})
//  Server creation starts here
const server = factory.createServer(opts.ssl, application);
server.listen(ssl ? 443 : 80, err => {
  if (err) {
    console.log('Well, this didn\'t work...');
    process.exit();
  }
  console.log('Server is listening....');
});


const wss_protocol = require('./irc-like-protocol.js').create();

const wss = new ws.Server({
  server,
  path: "/irc_websocket",
});

wss.on('connection', (webSocket, req) => {
  webSocket.remoteAddress = req.socket.remoteAddress;
  webSocket.hostname = req.socket.remoteAddress;
  wss_protocol(webSocket)
});

function ensureSecure(req, res, next){
  if(req.secure){
    // OK, continue
    return next();
  };
  // handle port numbers if you need non defaults
  // res.redirect('https://' + req.host + req.url); // express 3.x
  res.redirect('https://' + req.hostname + req.url); // express 4.x
}