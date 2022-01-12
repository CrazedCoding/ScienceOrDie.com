const fs = require('fs');
const jsdom = require('jsdom');
const jpeg = require('jpeg-js');
const { URL } = require('url')
// Regex containing the keys listed immediately above.
var htmlEscaper = /[&<>"'\/]/g;

// Escape a string for HTML interpolation.
function escapeTitle(string) {
  return ('' + string).replace(htmlEscaper, function (match) {
    return htmlEscapes[match];
  });
};

exports.render = function compile({ path, url, algorithm, safe_path, algorithm_list, opts }) {
  const dom = new jsdom.JSDOM(fs.readFileSync(path));
  const window = dom.window
  const document = window.document
  const vm = require('vm');
  const sandbox = {
    algorithm: algorithm ? algorithm : undefined,
    window: window,
    document: document,
    safe_path: safe_path ? safe_path : undefined,
    escapeTitle: escapeTitle,
    Buffer,
    algorithm_list: algorithm_list ? algorithm_list : undefined,
    server_hostname: opts.hostname ? opts.hostname : require('os').hostname,
    url,
    host: url ? new URL(url).host : undefined,
    opts
  };
  const context = new vm.createContext(sandbox);
  let looping = true;
  do {
    looping = false;
    const scripts = document.head.getElementsByTagName('script');
    let self_rendering = "";
    for (var index = 0; index < scripts.length; index++) {
      const script = scripts.item(index)
      const file = script.getAttribute('src')
      const classyness = script.getAttribute('class')
      const innerHTML = script.innerHTML
      if (classyness === 'self_rendering_code') {
        if (fs.existsSync(file)) {
          script.removeAttribute('src')
          script.removeAttribute('class')
          const text = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' }).toString()
          self_rendering += text + "\n"

        } else {
          script.removeAttribute('class')
          if (script.getAttribute('self_deleting'))
            script.remove()
          self_rendering += innerHTML + "\n"
        }
        looping = true;
      } else if (fs.existsSync(file)) {
        script.removeAttribute('src')
        const text = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' }).toString()
        script.innerHTML += text
        looping = true;
      }
    }
    try {
      const script = new vm.Script(self_rendering);

      script.runInContext(context, {
        lineOffset: 0,
        displayErrors: true,
      });
    } catch (e) {
      console.log(self_rendering)
      console.log(e)
    }
    const styles = document.head.getElementsByTagName('style');
    for (var index = 0; index < styles.length; index++) {
      const style = styles.item(index)
      const file = style.getAttribute('src')
      if (fs.existsSync(file)) {
        style.removeAttribute('src')
        const text = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' }).toString()
        style.innerHTML += text
        looping = true;
      }
    }
  } while (looping)
  return dom.serialize()
}

function Grad(x, y, z) {
  this.x = x; this.y = y; this.z = z;
}

Grad.prototype.dot2 = function(x, y) {
  return this.x*x + this.y*y;
};

Grad.prototype.dot3 = function(x, y, z) {
  return this.x*x + this.y*y + this.z*z;
};

var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
             new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
             new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];

var p = [151,160,137,91,90,15,
131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
// To remove the need for index wrapping, double the permutation table length
var perm = new Array(512);
var gradP = new Array(512);

// This isn't a very good seeding function, but it works ok. It supports 2^16
// different seed values. Write something better if you need more seeds.
seed = function(seed = new Date().getTime()) {
  if(seed > 0 && seed < 1) {
    // Scale the seed out
    seed *= 65536;
  }

  seed = Math.floor(seed);
  if(seed < 256) {
    seed |= seed << 8;
  }

  for(var i = 0; i < 256; i++) {
    var v;
    if (i & 1) {
      v = p[i] ^ (seed & 255);
    } else {
      v = p[i] ^ ((seed>>8) & 255);
    }

    perm[i] = perm[i + 256] = v;
    gradP[i] = gradP[i + 256] = grad3[v % 12];
  }
}();

  // Skewing and unskewing factors for 3 dimensions
  var F3 = 1/3;
  var G3 = 1/6;
// 3D simplex noise
function simplex3d(xin, yin, zin) {
  var n0, n1, n2, n3; // Noise contributions from the four corners

  // Skew the input space to determine which simplex cell we're in
  var s = (xin + yin + zin) * F3; // Hairy factor for 2D
  var i = Math.floor(xin + s);
  var j = Math.floor(yin + s);
  var k = Math.floor(zin + s);

  var t = (i + j + k) * G3;
  var x0 = xin - i + t; // The x,y distances from the cell origin, unskewed.
  var y0 = yin - j + t;
  var z0 = zin - k + t;

  // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
  // Determine which simplex we are in.
  var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
  var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
  // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
  // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
  // c = 1/6.
  var x1 = x0 - i1 + G3; // Offsets for second corner
  var y1 = y0 - j1 + G3;
  var z1 = z0 - k1 + G3;

  var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
  var y2 = y0 - j2 + 2 * G3;
  var z2 = z0 - k2 + 2 * G3;

  var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
  var y3 = y0 - 1 + 3 * G3;
  var z3 = z0 - 1 + 3 * G3;

  // Work out the hashed gradient indices of the four simplex corners
  i &= 255;
  j &= 255;
  k &= 255;
  var gi0 = gradP[i + perm[j + perm[k]]];
  var gi1 = gradP[i + i1 + perm[j + j1 + perm[k + k1]]];
  var gi2 = gradP[i + i2 + perm[j + j2 + perm[k + k2]]];
  var gi3 = gradP[i + 1 + perm[j + 1 + perm[k + 1]]];

  // Calculate the contribution from the four corners
  var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) {
    n0 = 0;
  } else {
    t0 *= t0;
    n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
  }
  var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) {
    n1 = 0;
  } else {
    t1 *= t1;
    n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
  }
  var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) {
    n2 = 0;
  } else {
    t2 *= t2;
    n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
  }
  var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) {
    n3 = 0;
  } else {
    t3 *= t3;
    n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
  }
  // Add contributions from each corner to get the final noise value.
  // The result is scaled to return values in the interval [-1,1].
  return 32 * (n0 + n1 + n2 + n3);

};
function sampleDigit(fDigit, vUV, seed) {

  // In this version, each digit is made up of a 4x5 array of bits

  var fDigitBinary = 0.0;

  // 0/0, 1/1, 10/2, 11/3, 100/4, 101/5, 110/6, 111/7

  if (fDigit < 0.5) // 0
  {
    fDigitBinary = 7.0 + 5.0 * 16.0 + 5.0 * 256.0 + 5.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 1.5) // 1
  {
    fDigitBinary = 2.0 + 2.0 * 16.0 + 2.0 * 256.0 + 2.0 * 4096.0 + 2.0 * 65536.0;
  }
  else if (fDigit < 2.5) // 2
  {
    fDigitBinary = 7.0 + 1.0 * 16.0 + 7.0 * 256.0 + 4.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 3.5) // 3
  {
    fDigitBinary = 7.0 + 4.0 * 16.0 + 7.0 * 256.0 + 4.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 4.5) // 4
  {
    fDigitBinary = 4.0 + 7.0 * 16.0 + 5.0 * 256.0 + 1.0 * 4096.0 + 1.0 * 65536.0;
  }
  else if (fDigit < 5.5) // 5
  {
    fDigitBinary = 7.0 + 4.0 * 16.0 + 7.0 * 256.0 + 1.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 6.5) // 6
  {
    fDigitBinary = 7.0 + 5.0 * 16.0 + 7.0 * 256.0 + 1.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 7.5) // 7
  {
    fDigitBinary = 4.0 + 4.0 * 16.0 + 4.0 * 256.0 + 4.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 8.5) // 8
  {
    fDigitBinary = 7.0 + 5.0 * 16.0 + 7.0 * 256.0 + 5.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 9.5) // 9
  {
    fDigitBinary = 7.0 + 4.0 * 16.0 + 7.0 * 256.0 + 5.0 * 4096.0 + 7.0 * 65536.0;
  }
  else if (fDigit < 10.5) // '.'
  {
    fDigitBinary = 2.0 + 0.0 * 16.0 + 0.0 * 256.0 + 0.0 * 4096.0 + 0.0 * 65536.0;
  }
  else if (fDigit < 11.5) // '-'
  {
    fDigitBinary = 0.0 + 0.0 * 16.0 + 7.0 * 256.0 + 0.0 * 4096.0 + 0.0 * 65536.0;
  }

  var vPixel = {
    x: vUV.x * 10.0-3,
    y: vUV.y * 11.0-3
  }


  var ml = 1E32;
  for (var y = -1; y < 5.; y++) {
    var line = Math.floor(fDigitBinary / Math.pow(2, (y) * 4))
    for (var x = -1; x < 4.; x++) {
      var bit = Math.floor(line / Math.pow(2, (x))) % 2.0;
      var vDigit = { x, y }
      var dx = ((vDigit.x - vPixel.x));
      var dy = ((vDigit.y - vPixel.y));
      var l = Math.sqrt(dx * dx + dy * dy)
      if (ml > l && bit)
        ml = l;
    }
  }
  return Math.max(1. - ml/3., 0.);
  // var fIndex = vPixel.x + (vPixel.y * 4.0);
  // return (Math.floor(fDigitBinary / Math.pow(2.0, fIndex)) % 2.0);
}

function draw(uv, number, number_count, seed) {
  var new_number = (Math.floor((number) / Math.pow(10., Math.floor((1. - uv.x) * number_count))) % 10.0);

  var ox = (new_number*seed)%2-1.
  var oy = (321+123*new_number*seed)%3-1.

  uv.x += ox/number_count/4.;
  uv.y += oy/number_count/4.;

  return sampleDigit(new_number, { x: (uv.x * number_count % 1.), y: uv.y}, seed);

}



exports.render_captcha = function (answer) {
  var number_count = 4;
  var number = 0;
  var number_size = 64;
  function getNumber() {
    var n = 0
    for (var i = 0; i < number_count; i++) {
      n += Math.floor(Math.random() * Math.pow(10, i + 1));
    }
    return n;
  }
  var seed = new Date().getTime();
  answer = (answer ? answer : getNumber());
  var pixels = []
  var size = number_count * number_size;
  for (var i = 0.; i < 1.; i += 1. / size) {
    var line = []
    for (var j = 0.; j < 1.; j += 1. / number_size) {
      line.push(draw({ x: i, y: j }, answer, number_count, seed))
    }
    pixels.push(line)
  }
  pixels = pixels.map((a) => a.reverse());
  var jpeg = require('jpeg-js');
  var width = number_count * number_size,
    height = number_size;
  var frameData = Buffer.alloc(width * height * 4);
  var index = 0;
  for (var j = 0; j < number_size; j++) {
    for (var i = 0; i < width*height; i++) {
      var pixel = pixels[i%size][Math.floor(i/size)];
      var xyz= [(i%size)/number_size, Math.floor(i/size)/number_size, answer]
      var s = simplex3d(xyz[0], xyz[1], xyz[2]+pixel)*.5+.5
      var b = Math.pow(simplex3d(xyz[2], xyz[1], xyz[0])*.5+.5, 1./4.)
      
      pixel += (1.-pixel)*s
      pixel *= Math.PI*6.
      pixel += seed
      pixel += xyz[0]+xyz[1]
      frameData[index++] = Math.floor((Math.cos(pixel)*.5+.5)*256); // red
      frameData[index++] = Math.floor((Math.cos(pixel+Math.PI*4./3.)*.5+.5)*256); // green
      frameData[index++] = Math.floor((Math.cos(pixel+Math.PI*2./3.)*.5+.5)*256); // blue
      frameData[index++] = 0xff; // alpha - ignored in JPEGs
    }
  }
  var rawImageData = {
    data: frameData,
    width: width,
    height: height,
  };
  var image = jpeg.encode(rawImageData, 100).data
  return { answer, image }
}