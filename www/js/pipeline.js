var default_fragment_shader =
  `
  #define GLSL_INSERTION_POINT
  `
var default_vertex_shader =
  `
  #define GLSL_INSERTION_POINT
  `
var userAlgorithm = null;

var pipeline = null;

var loadedCanvasCount;

var promptStart, showLoading, hideError, hideLoading, saveAlgorithm, getListOfLanguages, voiceToText, translateLanguage, speakTextUsingGoogleSpeaker;

var global_frequency, global_volume;

function str2bin(str) {
  var result = [];
  for (var i = 0; i < str.length; i++) {
    result.push(str.charCodeAt(i));
  }
  return result;
}

function bin2str(array) {
  return String.fromCharCode.apply(String, array);
}

const OpenGLDimension = Format.OpenGLDimension
const OpenGLUniform = Format.OpenGLUniform
const OpenGLStageTypes = Format.OpenGLStage.Type;

var is_safari = (navigator.userAgent.indexOf("iPhone") > -1 || navigator.userAgent.indexOf("iPad") > -1 || navigator.userAgent.indexOf("Safari") > -1) && navigator.userAgent.indexOf("Chrome") == -1;
// var Auth, Image, Video, Sound, Person, Comment, MetaAlgorithm, 
//     Query, Catalog, Vote, OpenGLDimension, OpenGLUniform, OpenGLContext, 
//     OpenGLProgram, OpenGLStage, OpenGLPipeline, AlgorithmState, 
//     Algorithm, Custom, Error, Captcha;

window.requestAnimFrame = (function () {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
      window.setTimeout(callback, 1000 / 60);
    };
})();


var api_names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];

var OpenGLPipeline = function (pipleline_proto) { // "Constructor."
  this.currentContext = 0;
  this.contexts = [];

  if (pipleline_proto.contexts)
    for (var i = 0; i < pipleline_proto.contexts.length; i++) {
      this.addContext(pipleline_proto.contexts[i]);
      this.contexts[i].canvas.style.zIndex = i - pipleline_proto.contexts.length;
    }

  this.programs = [];
  this.cached_programs = [];

  if (pipleline_proto.programs)
    for (var i = 0; i < pipleline_proto.programs.length; i++)
      this.addProgram(pipleline_proto.programs[i]);

  this.stages = [];
  this.cached_stages = [];

  if (pipleline_proto.stages)
    for (var i = 0; i < pipleline_proto.stages.length; i++)
      this.addStage(pipleline_proto.stages[i]);
};

OpenGLPipeline.prototype.addContext = function (context_proto) {
  var context = new OpenGLContext(context_proto);
  this.contexts.push(context);
};

OpenGLPipeline.prototype.addProgram = function (program_proto) {
  var program = new OpenGLProgram(program_proto);
  this.programs.push(program);
};

OpenGLPipeline.prototype.addStage = function (stage_proto) {
  var stage = new OpenGLStage(stage_proto);
  this.stages.push(stage);
};

OpenGLPipeline.prototype.renderLoop = function () {
  this.currentContext++;
  this.anim = {
    renderLoop: (function (x) {
      this.render(x);
      if (x == this.currentContext)
        window.requestAnimationFrame(this.anim.renderLoop.bind(this.anim, x));
    }).bind(this)
  };
  this.anim.renderLoop(this.currentContext);
}
OpenGLPipeline.prototype.getProgram = function (name) {

  for (var i = 0; i < this.programs.length; i++)
    if (this.programs[i].program.name == name)
      return this.programs[i];
  return null;
}
OpenGLPipeline.prototype.getContext = function (name) {
  for (var i = 0; i < this.contexts.length; i++)
    if (this.contexts[i].context.name == name)
      return this.contexts[i];
  return null;
}

OpenGLPipeline.prototype.render = function () {
  for (var i = 0; i < this.stages.length; i++)
    this.getContext(this.stages[i].stage.context).render(this.getProgram(this.stages[i].stage.program), this.stages[i]);
}

OpenGLPipeline.prototype.destroy = function () {
  this.currentContext++;

  for (var i = 0; i < this.stages.length; i++)
    this.stages[i].destroy();

  this.stages = [];
}

OpenGLPipeline.prototype.setProto = function (new_proto) {

  //this.destroy();

  var new_contexts = new_proto.contexts;

  if (new_contexts) {
    this.contexts = []

    while (this.contexts.length < new_contexts.length)
      this.contexts.push(new OpenGLContext());


    for (var i = 0; i < new_contexts.length; i++)
      this.contexts[i].setProto(new_contexts[i]);
  }


  var new_programs = new_proto.programs;

  if (new_programs) {
    if (this.programs) {
      if (this.programs.length > new_programs.length) {
        var spliced = this.programs.splice(new_programs.length, this.programs.length - new_programs.length);
        for (var i = 0; i < spliced.length; i++)
          this.cached_programs.push(spliced[i]);
      }
      else if (this.programs.length == new_programs.length) {
        //NO OP
      }
      else {
        while (this.cached_programs.length > 0 && this.programs.length < new_programs.length)
          this.programs.push(this.cached_programs.splice(0, 1)[0]);
        while (this.programs.length < new_programs.length)
          this.programs.push(new OpenGLProgram());
      }

      for (var i = 0; i < new_programs.length; i++)
        this.programs[i].setProto(new_programs[i]);
    }
  }


  var new_stages = new_proto.stages;

  if (new_stages) {
    this.stages = []
    while (this.stages.length < new_stages.length)
      this.stages.push(new OpenGLStage());
    for (var i = 0; i < new_stages.length; i++)
      this.stages[i].setProto(new_stages[i]);
  }
}

var OpenGLContext = function (context_proto) { // "Constructor."

  this.context = context_proto ? context_proto : {};
  errorCode = { error: "", code: "" };
  this.gl = null;
  this.setProto(context_proto ? context_proto : {});
};

OpenGLContext.prototype.setProto = function (context_proto) {
  this.context = context_proto;

  if (!this.canvas) {
    this.canvas = document.createElement('canvas');
  }

  if (!context_proto.name) {
    var newId = 'canvas' + (new Date().getTime());
    this.canvas.id = newId;
    this.context.name = newId;
  }
  else {
    this.canvas.id = context_proto.name;
    this.context.name = context_proto.name;
  }

  if (!context_proto.width) {
    var newWidth = {}
    newWidth.type = OpenGLDimension.Type.SCREEN_SIZE;
    this.context.width = newWidth;
  }
  else {
    this.context.width = context_proto.width;
  }

  if (!context_proto.height) {
    var newHeight = {}
    newHeight.type = OpenGLDimension.Type.SCREEN_SIZE;
    this.context.height = newHeight;
  }
  else {
    this.context.height = context_proto.height;
  }


  if (context_proto.images)
    this.setImages(context_proto.images);

  this.textures = [];

  if (this.context.width.type == OpenGLDimension.Type.EXACT)
    this.cached_width_eval = new Function(this.context.width.value);

  if (this.context.height.type == OpenGLDimension.Type.EXACT)
    this.cached_height_eval = new Function(this.context.height.value);

  this.initGL();

  this.resizeCanvas();


    window.document.body.append(this.canvas)
}


OpenGLContext.prototype.setImages = function (images) {
  if (images)
    this.context.images = images;
  else
    this.context.images = [];

  this.refreshImages();
};
OpenGLContext.prototype.refreshImages = function () {
  this.img_elements = [];

  var x = document.getElementsByClassName("loaded-image");
  var i;
  for (i = 0; i < x.length; i++) {
    x[i].parentElement.removeChild(x[i]);
  }

  loadedCanvasCount = 0;
  for (var i = 0; i < this.context.images.length; i++) {
    var img = document.createElement('img');
    img.classList.add("loaded-image");
    img.id = "loaded-image" + i;
    this.img_elements.push(img)
    img.onload = (function () {
      if ((++loadedCanvasCount) == this.context.images.length) {
        this.refreshCanvases();
      }
    }).bind(this);
    var url = this.context.images[i].url ? this.context.images[i].url : bin2str(this.context.images[i].image);
    img.src = url;
  }
}

OpenGLContext.prototype.refreshCanvases = function () {
  this.canvases = [];
  for (var i = 0; i < this.context.images.length; i++) {
    var canvas = document.createElement('canvas');
    var img = this.img_elements[i];
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.classList.add("loaded-image");
    canvas.id = "image-canvas" + i;

    var ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);
    this.canvases.push(canvas);
  }
}

OpenGLContext.prototype.refreshImage = function (image) {
  try {
    var img = document.getElementById("loaded-image" + (image.index));
    var canvas = document.getElementById("image-canvas" + (image.index));
    canvas.width = img.width;
    canvas.height = img.height;

    var ctx = canvas.getContext("2d",
      {
        alpha: true,
        depth: this.context.depth_test,
        stencil: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false
      });

    if (is_safari)
      ctx.transform(1, 0, 0, -1, 0, canvas.height)

    ctx.drawImage(img, 0, 0);
  }
  catch (e) {
    console.error("Error refreshing image: " + e);
  }
}


OpenGLContext.prototype.destroy = function () {
  var numTextureUnits = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);
  for (var unit = 0; unit < numTextureUnits; ++unit) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null);
  }
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

  this.textures = [];
  this.gl.deleteBuffer(this.vertex_buffer);
  this.gl.deleteBuffer(this.index_buffer);
  delete this.canvas;
  this.canvas = null;
  delete this.gl;
  this.gl = null;
}
OpenGLContext.prototype.initGL = function () {
  this.time = 0;
  this.lastTime = 0;

  this.fpsElapsedTime = 0;
  this.fpsFrameCount = 0;
  this.fpsLastTime = new Date().getTime();
  if (this.canvas && !this.gl) {
    for (var ii = 0; ii < api_names.length; ++ii) {
      try {
        this.gl = this.canvas.getContext(api_names[ii],
          {
            alpha: true,
            depth: this.context.depth_test,
            stencil: false,
            antialias: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false
          });
        this.gl.getExtension("OES_standard_derivatives");
        this.gl.getExtension("EXT_frag_depth");
        this.gl.getExtension('OES_texture_float');
        // this.glgetExtension('OES_texture_float_linear');
        // this.glgetExtension("OES_element_index_uint");
        // this.glgetExtension("WEBGL_color_buffer_float");
        // this.glgetExtension("EXT_color_buffer_float");
      } catch (e) { }
      if (this.gl) {
        break;
      }
    }
  }

  if (!this.gl) {
    errorCode = { report: "", code: "" };
    errorCode.report += "Could not initialise WebGL, sorry :-(";
    console.error(errorCode.report, errorCode.code);
    return;
  }

  if (!this.context.depth_test)
    this.gl.disable(this.gl.DEPTH_TEST);
  else
    this.gl.enable(this.gl.DEPTH_TEST);
};


OpenGLContext.prototype.resizeCanvas = function () {


  if (this.context.width.type == OpenGLDimension.Type.SCREEN_SIZE) {
    this.computed_width = window.innerWidth;
  }
  else if (this.context.width.type == OpenGLDimension.Type.NEXT_LOWEST_POWER_OF_TWO) {
    this.computed_width = Math.pow(2, Math.floor(Math.log(window.innerWidth) / Math.log(2.0)));
  }
  else if (this.context.width.type == OpenGLDimension.Type.NEXT_HIGHEST_POWER_OF_TWO) {
    this.computed_width = Math.pow(2, Math.floor(1. + Math.log(window.innerWidth) / Math.log(2.0)));
  }
  else if (this.context.width.type == OpenGLDimension.Type.EXACT) {
    this.computed_width = this.cached_width_eval.bind(this)(this);
  }

  if (this.context.height.type == OpenGLDimension.Type.SCREEN_SIZE) {
    this.computed_height = window.innerHeight
  }
  else if (this.context.height.type == OpenGLDimension.Type.NEXT_LOWEST_POWER_OF_TWO) {
    this.computed_height = Math.pow(2, Math.floor(Math.log(window.innerHeight) / Math.log(2.0)));
  }
  else if (this.context.height.type == OpenGLDimension.Type.NEXT_HIGHEST_POWER_OF_TWO) {
    this.computed_height = Math.pow(2, Math.floor(1. + Math.log(window.innerHeight) / Math.log(2.0)));
  }
  else if (this.context.height.type == OpenGLDimension.Type.EXACT) {
    this.computed_height = this.cached_height_eval.bind(this)(this);
  }
  this.canvas.width = this.computed_width;
  this.canvas.height = this.computed_height;

};

OpenGLContext.prototype.render = function (program, stage) {

  var now = new Date().getTime();
  this.fpsFrameCount++;
  this.fpsElapsedTime += (now - this.fpsLastTime);
  this.fpsLastTime = now;

  if (this.fpsFrameCount > 60) {
    var fps = this.fpsFrameCount / this.fpsElapsedTime * 1000.0;
    this.fpsFrameCount = 0;
    this.fpsElapsedTime = 0;
  }

  if (this.context.image && this.context.images) {

    if (this.reloadTextures) {

      for (var i = 0; i < this.context.images.length; i++)
        this.refreshImage(i);

      // for (var i = 0; i < this.textures.length; i++)
      //   this.gl.deleteTexture(this.textures[i]);
      // this.textures = [];

      // for (var i = 0; i < this.context.images.length; i++) {
      //   if (!this.img_elements[i])
      //     return;

      //   var texture = this.gl.createTexture();
      //   this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

      //   // Set the parameters so we can render hany size image.
      //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

      //   // Upload the image into the texture.
      //   this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.img_elements[i]);

      //   // add the texture to the array of textures.    
      //   this.textures.push(texture);
      // }
      this.reloadTextures = false;
    }
  }


  ////////////////////////////////////////////////////////////////////////////////////////////////////

  //this.gl.clear(this.gl.DEPTH_BUFFER_BIT | this.gl.COLOR_BUFFER_BIT);

  if (!this.cached_programs)
    this.cached_programs = {};

  if (!this.cached_programs[program.program.name+'-'+this.context.name]) {
    this.cached_programs[program.program.name+'-'+this.context.name] = program.getProgram(this);
    if (!this.cached_programs[program.program.name+'-'+this.context.name])
      throw new Error();
  }

  this.gl.useProgram(this.cached_programs[program.program.name+'-'+this.context.name]);
  stage.refreshGeometry(this, program);
  program.setUniforms(this, stage);
  this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  stage.drawMesh(this, program);
}

var OpenGLProgram = function (program_proto) { // "Constructor."

  this.program = program_proto ? program_proto : {};
  errorCode = { error: "", code: "" };
  this.setProto(program_proto ? program_proto : {});
};

OpenGLProgram.prototype.setProto = function (program_proto) {
  this.program = program_proto;


  this.cached_uniform_evals = [];
  for (var i = 0; this.program.uniforms && i < this.program.uniforms.length; i++)
    this.cached_uniform_evals[i] = new Function(this.program.uniforms[i].value);
}

OpenGLProgram.prototype.setUniforms = function (context, stage) {
  var shader = context.cached_programs[this.program.name+'-'+context.context.name];
  for (var i = 0; (this.program.uniforms) && (this.cached_uniform_evals) && (i < this.program.uniforms.length) && (i < this.cached_uniform_evals.length); i++) {
    var location = context.gl.getUniformLocation(shader, this.program.uniforms[i].name);
    var type = this.program.uniforms[i].type;
    var value = this.cached_uniform_evals[i].bind(this)(context, this, stage);

    var type = this.program.uniforms[i].type;


    inner: switch (type) {
      case OpenGLUniform.Type.FLOAT:
        type = 'float';
        context.gl.uniform1f(location, value);
        break inner;
      case OpenGLUniform.Type.INT:
        type = 'int';
        context.gl.uniform1i(location, value);
        break inner;
      case OpenGLUniform.Type.BOOL:
        type = 'bool';
        context.gl.uniform1i(location, value);
        break inner;
      case OpenGLUniform.Type.VEC_TWO:
        type = 'vec2';
        context.gl.uniform2f(location, value[0], value[1]);
        break inner;
      case OpenGLUniform.Type.VEC_THREE:
        type = 'vec3';
        context.gl.uniform3f(location, value[0], value[1], value[2]);
        break inner;
      case OpenGLUniform.Type.VEC_FOUR:
        type = 'vec4';
        context.gl.uniform4f(location, value[0], value[1], value[2], value[3]);
        break inner;
      case OpenGLUniform.Type.IVEC_TWO:
        type = 'ivec2';
        context.gl.uniform2i(location, value[0], value[1]);
        break inner;
      case OpenGLUniform.Type.IVEC_THREE:
        type = 'ivec3';
        context.gl.uniform3i(location, value[0], value[1], value[2]);
        break inner;
      case OpenGLUniform.Type.IVEC_FOUR:
        type = 'ivec4';
        context.gl.uniform4i(location, value[0], value[1], value[2], value[3]);
        break inner;
      case OpenGLUniform.Type.BVEC_TWO:
        type = 'bvec2';
        context.gl.uniform2i(location, value[0], value[1]);
        break inner;
      case OpenGLUniform.Type.BVEC_THREE:
        type = 'bvec3';
        context.gl.uniform3i(location, value[0], value[1], value[2]);
        break inner;
      case OpenGLUniform.Type.BVEC_FOUR:
        type = 'bvec4';
        context.gl.uniform4i(location, value[0], value[1], value[2], value[3]);
        break inner;
      case OpenGLUniform.Type.MAT_TWO:
        type = 'mat2';
        context.gl.uniformMatrix2fv(location, false, value);
        break inner;
      case OpenGLUniform.Type.MAT_THREE:
        type = 'mat3';
        context.gl.uniformMatrix3fv(location, false, value);
        break inner;
      case OpenGLUniform.Type.MAT_FOUR:
        type = 'mat4';
        context.gl.uniformMatrix4fv(location, false, value);
        break inner;
      case OpenGLUniform.Type.SAMPLER_TWO_D:
        type = 'sampler2D';
        context.gl.uniform1i(location, value);
        break inner;
      case OpenGLUniform.Type.SAMPLERCUBE:
        type = 'samplerCube';
        context.gl.uniform1i(location, value);
        break inner;
    }
  }
}


OpenGLProgram.prototype.getUniforms = function () {
  var str = "";
  for (var i = 0; (this.program.uniforms) && (i < this.program.uniforms.length); i++) {
    var type = this.program.uniforms[i].type;


    inner: switch (type) {
      case OpenGLUniform.Type.FLOAT: type = 'float'; break inner;
      case OpenGLUniform.Type.INT: type = 'int'; break inner;
      case OpenGLUniform.Type.BOOL: type = 'bool'; break inner;
      case OpenGLUniform.Type.VEC_TWO: type = 'vec2'; break inner;
      case OpenGLUniform.Type.VEC_THREE: type = 'vec3'; break inner;
      case OpenGLUniform.Type.VEC_FOUR: type = 'vec4'; break inner;
      case OpenGLUniform.Type.IVEC_TWO: type = 'ivec2'; break inner;
      case OpenGLUniform.Type.IVEC_THREE: type = 'ivec3'; break inner;
      case OpenGLUniform.Type.IVEC_FOUR: type = 'ivec4'; break inner;
      case OpenGLUniform.Type.BVEC_TWO: type = 'bvec2'; break inner;
      case OpenGLUniform.Type.BVEC_THREE: type = 'bvec3'; break inner;
      case OpenGLUniform.Type.BVEC_FOUR: type = 'bvec4'; break inner;
      case OpenGLUniform.Type.MAT_TWO: type = 'mat2'; break inner;
      case OpenGLUniform.Type.MAT_THREE: type = 'mat3'; break inner;
      case OpenGLUniform.Type.MAT_FOUR: type = 'mat4'; break inner;
      case OpenGLUniform.Type.SAMPLER_TWO_D: type = 'sampler2D'; break inner;
      case OpenGLUniform.Type.SAMPLERCUBE: type = 'samplerCube'; break inner;
    }


    var name = this.program.uniforms[i].name;

    str += "uniform " + type + " " + name + ";\n";
  }
  return str;
}


OpenGLProgram.prototype.getTemplateVertexShader = function (context) {
  var str = default_vertex_shader + ""

  var delimeter = "#define GLSL_INSERTION_POINT";
  var head = str.substring(0, str.indexOf(delimeter));
  var tail = str.substring(str.indexOf(delimeter) + delimeter.length);
  var custom = this.program.vertex;

  str = head + "\n" + delimeter + "\n" + custom + "\n" + tail;

  delimeter = "#define UNIFORM_INSERTION_POINT";
  var line = str.indexOf(delimeter);
  if (line >= 0) {
    head = str.substring(0, line);
    tail = str.substring(line + delimeter.length);
    var uniforms = this.getUniforms();
    str = head + "\n" + delimeter + "\n" + uniforms + "\n" + tail;
  }
  var shader;
  shader = context.gl.createShader(context.gl.VERTEX_SHADER);

  context.gl.shaderSource(shader, str);
  context.gl.compileShader(shader);

  if (!context.gl.getShaderParameter(shader, context.gl.COMPILE_STATUS)) {
    errorCode.report += "Vertex Shader for CANVAS_ID=#" + this.program.canvas_id + " Error:\n\n";
    errorCode.report += context.gl.getShaderInfoLog(shader);
    errorCode.report += "\n\n\n";

    var transpiled = "";
    var lines = str.split('\n');

    for (var i = 0; i < lines.length; i++) {
      transpiled += (i + 1) + ":\t" + lines[i] + "\n";
    }

    errorCode.code += "Vertex Shader Code:\n\n";
    errorCode.code += transpiled;
    return null;
  }

  return shader;
}
OpenGLProgram.prototype.getTemplateFragmentShader = function (context) {
  var str = default_fragment_shader + ""

  var delimeter = "#define GLSL_INSERTION_POINT";
  var head = str.substring(0, str.indexOf(delimeter));
  var tail = str.substring(str.indexOf(delimeter) + delimeter.length);
  var custom = this.program.fragment;

  str = head + "\n" + delimeter + "\n" + custom + "\n" + tail;

  delimeter = "#define UNIFORM_INSERTION_POINT";
  var line = str.indexOf(delimeter);
  if (line >= 0) {
    head = str.substring(0, line);
    tail = str.substring(line + delimeter.length);
    var uniforms = this.getUniforms();
    str = head + "\n" + delimeter + "\n" + uniforms + "\n" + tail;
  }
  var shader;
  shader = context.gl.createShader(context.gl.FRAGMENT_SHADER);

  context.gl.shaderSource(shader, str);
  context.gl.compileShader(shader);

  if (!context.gl.getShaderParameter(shader, context.gl.COMPILE_STATUS)) {
    // alert(context.glgetShaderInfoLog(shader));
    errorCode.report += "Fragment Shader for CANVAS_ID=#" + this.program.canvas_id + " Error:\n\n";
    errorCode.report += context.gl.getShaderInfoLog(shader);
    errorCode.report += "\n\n\n";

    var transpiled = "";
    var lines = str.split('\n');

    for (var i = 0; i < lines.length; i++) {
      transpiled += (i + 1) + ":\t" + lines[i] + "\n";
    }

    errorCode.code += "Fragment Shader Code:\n\n";
    errorCode.code += transpiled;
    return null;
  }

  return shader;
}
OpenGLProgram.prototype.getProgram = function (context) {
  errorCode = { report: "", code: "" };
  var fragment_shader = this.getTemplateFragmentShader(context);
  if (!fragment_shader) {
    console.error(errorCode.report, errorCode.code);
    return;
  }

  var vertex_shader = this.getTemplateVertexShader(context);

  if (!vertex_shader) {
    console.error(errorCode.report, errorCode.code);
    return;
  }

  var shader_program = context.gl.createProgram();
  context.gl.attachShader(shader_program, fragment_shader);
  context.gl.attachShader(shader_program, vertex_shader);
  context.gl.linkProgram(shader_program);

  if (!context.gl.getProgramParameter(shader_program, context.gl.LINK_STATUS)) {
    errorCode.report += "\nUnable to link program!";
    context.gl.deleteProgram(shader_program);
    console.error(errorCode.report, errorCode.code);
  }

  context.gl.useProgram(shader_program);


  shader_program.vertexAttribute = context.gl.getAttribLocation(shader_program, "vertex");
  if (shader_program.vertexAttribute > -1)
    context.gl.enableVertexAttribArray(shader_program.vertexAttribute);

  shader_program.colorAttribute = context.gl.getAttribLocation(shader_program, "color");
  if (shader_program.colorAttribute > -1)
    context.gl.enableVertexAttribArray(shader_program.colorAttribute);

  shader_program.shapeAttribute = context.gl.getAttribLocation(shader_program, "shape");
  if (shader_program.shapeAttribute > -1)
    context.gl.enableVertexAttribArray(shader_program.shapeAttribute);


  return shader_program;
}

var OpenGLStage = function (stage_proto) { // "Constructor."

  this.stage = stage_proto ? stage_proto : {};
  this.setProto(stage_proto ? stage_proto : {});
};
OpenGLStage.prototype.setProto = function (stage_proto) {
  this.stage = stage_proto;

  this.cached_vertices = new Function(this.stage.vertices);
  this.cached_indices_eval = new Function(this.stage.indices);
};

OpenGLStage.prototype.drawMesh = function (context, program) {
  if (this.stage.type == OpenGLStageTypes.SHADER)
    context.gl.drawElements(context.gl.TRIANGLE_STRIP, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_POINTS)
    context.gl.drawElements(context.gl.POINTS, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_LINES)
    context.gl.drawElements(context.gl.LINES, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_LINE_STRIP)
    context.gl.drawElements(context.gl.LINE_STRIP, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_LINE_LOOP)
    context.gl.drawElements(context.gl.LINE_LOOP, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_TRIANGLES)
    context.gl.drawElements(context.gl.TRIANGLES, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_TRIANGLE_FAN)
    context.gl.drawElements(context.gl.TRIANGLE_FAN, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
  else if (this.stage.type == OpenGLStageTypes.MESH_TRIANGLE_STRIP)
    context.gl.drawElements(context.gl.TRIANGLE_STRIP, this.index_buffer.numItems, context.gl.UNSIGNED_SHORT, 0);
};



OpenGLStage.prototype.iniAttributeBuffers = function (context) {

  if (this.vertex_buffer)
    context.gl.deleteBuffer(this.vertex_buffer);
  if (this.color_buffer)
    context.gl.deleteBuffer(this.color_buffer);
  if (this.shape_buffer)
    context.gl.deleteBuffer(this.shape_buffer);
  if (this.index_buffer)
    context.gl.deleteBuffer(this.index_buffer);
  this.vertex_buffer = null;
  this.color_buffer = null;
  this.shape_buffer = null;
  this.index_buffer = null;
  this.vertex_buffer = context.gl.createBuffer();
  this.color_buffer = context.gl.createBuffer();
  this.shape_buffer = context.gl.createBuffer();
  this.index_buffer = context.gl.createBuffer();
}

OpenGLStage.prototype.refreshGeometry = function (context, program) {

  if (!this.vertex_buffer || !this.color_buffer || !this.shape_buffer || !this.index_buffer)
    this.iniAttributeBuffers(context);

  var new_vertices = null;
  var new_indices = null;

  if (this.stage.type == OpenGLStageTypes.SHADER) {
    new_vertices =
      [[
        0, 0, 0.0, 1.,
        context.computed_width, 0, 0.0, 1.,
        context.computed_width, context.computed_height, 0.0, 1.,
        0, context.computed_height, 0.0, 1.
      ]];
    new_indices = [
      0, 1, 2, 0, 2, 3// Front face
    ];
  }
  else {
    new_vertices = this.cached_vertices.bind(this)(context, program, this);
    new_indices = this.cached_indices_eval.bind(this)(context, program, this);
  }

  this.vertices = new_vertices;;
  this.indices = new_indices;;

  /*
  var update = false;

  if(!this.vertices || this.vertices.length!=new_vertices.length || !(this.vertices.every(function(v,i) { return v === new_vertices[i]; })))
  {
    this.vertices = new_vertices;;
    update = true;
  }

  if(!this.indices || this.indices.length!=new_indices.length || !(this.indices.every(function(v,i) { return v === new_indices[i]; })))
  {
    this.indices = new_indices;;
    update = true;
  }
  */

  //if(update)
  {

    this.vertex_buffer.itemSize = 4;
    this.color_buffer.itemSize = 4;
    this.shape_buffer.itemSize = 4;
   
    var shader = context.cached_programs[program.program.name+'-'+context.context.name];

    if (this.vertices.length > 0) {
      context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this.vertex_buffer);
      context.gl.bufferData(context.gl.ARRAY_BUFFER, new Float32Array(this.vertices[0]), context.gl.DYNAMIC_DRAW);
      context.gl.enableVertexAttribArray(shader.vertexAttribute);
      context.gl.vertexAttribPointer(shader.vertexAttribute, this.vertex_buffer.itemSize, context.gl.FLOAT, false, 0, 0);
    }
    if (this.vertices.length > 1) {
      context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this.color_buffer);
      context.gl.bufferData(context.gl.ARRAY_BUFFER, new Float32Array(this.vertices[1]), context.gl.DYNAMIC_DRAW);
      context.gl.enableVertexAttribArray(shader.colorAttribute);
      context.gl.vertexAttribPointer(shader.colorAttribute, this.color_buffer.itemSize, context.gl.FLOAT, false, 0, 0);
    }
    if (this.vertices.length > 2) {
      context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this.shape_buffer);
      context.gl.bufferData(context.gl.ARRAY_BUFFER, new Float32Array(this.vertices[2]), context.gl.DYNAMIC_DRAW);
      context.gl.enableVertexAttribArray(shader.shapeAttribute);
      context.gl.vertexAttribPointer(shader.shapeAttribute, this.shape_buffer.itemSize, context.gl.FLOAT, false, 0, 0);
    }

    context.gl.bindBuffer(context.gl.ELEMENT_ARRAY_BUFFER, this.index_buffer);
    context.gl.bufferData(context.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), context.gl.DYNAMIC_DRAW);
    this.index_buffer.itemSize = 1;
    this.index_buffer.numItems = this.indices.length;
  }
}
var thumbnailDim = 1024;
var updateAlgorithmThumbnailAndSave = false;
var reloadTextures = false;

function reload_algorithm() {
  if (userAlgorithm != undefined &&
    userAlgorithm != null &&
    userAlgorithm.client != undefined) {
    document.head.innerHTML += '<script>' +
      userAlgorithm.client + "<script>";
    eval.call(window, userAlgorithm.client)
  }

  if (userAlgorithm &&
    userAlgorithm.html) {
      document.body.innerHTML = (userAlgorithm.html);
  }


  if (pipeline) {
    //pipeline.destroy();
    if (userAlgorithm && userAlgorithm.pipeline)
      pipeline.setProto(userAlgorithm.pipeline)
  }
  else {
    if (userAlgorithm && userAlgorithm.pipeline)
      pipeline = new OpenGLPipeline(userAlgorithm.pipeline);
  }

  if (pipeline)
    pipeline.renderLoop();
}

window.addEventListener('message', function (e) {
  try {
    if (e.data.compile) {
      userAlgorithm = JSON.parse(e.data.compile);
      reload_algorithm(); 
    } else if (e.data.execute) {
      eval.call(window, e.data.command);
    } else if (e.data.share) {
      html2canvas((document.body)).then(function (canvas) {
        // canvas is the final rendered <canvas> element
        var img = document.createElement('img');
        img.onload = (function () {
          var resize_canvas = document.createElement('canvas');

          resize_canvas.width = thumbnailDim;
          resize_canvas.height = thumbnailDim;
          //canvas.id="image-canvas-context"+this.context+"-index"+this.index;

          var ctx = resize_canvas.getContext("2d");

          ctx.drawImage(img, 0, 0, thumbnailDim, thumbnailDim);

          var url = resize_canvas.toDataURL();
          userAlgorithm.thumbnail = url;
          window.parent.postMessage(JSON.stringify({ save: true, algorithm: userAlgorithm, hash: e.data.hash }), '*')
        }.bind(this));
        var url = canvas.toDataURL("image/png");
        img.src = url;
      }).catch(() => {
        if (pipeline && pipeline.contexts && pipeline.contexts.length > 0) {
          var canvas = pipeline.contexts[0].canvas;
          var img = document.createElement('img');
          img.onload = (function () {
            var resize_canvas = document.createElement('canvas');

            resize_canvas.width = thumbnailDim;
            resize_canvas.height = thumbnailDim;
            //canvas.id="image-canvas-context"+this.context+"-index"+this.index;

            var ctx = resize_canvas.getContext("2d");

            ctx.drawImage(img, 0, 0, thumbnailDim, thumbnailDim);

            var url = resize_canvas.toDataURL();
            userAlgorithm.thumbnail = url;
            window.parent.postMessage(JSON.stringify({ save: true, algorithm: userAlgorithm, hash: e.data.hash }), '*')
          }).bind(this);

          var url = canvas.toDataURL();
          img.src = url;
        }
        else
          window.parent.postMessage(JSON.stringify({ save: true, algorithm: userAlgorithm, hash: e.data.hash }), '*')
      });
    }
  } catch (e) {
    console.debug(e.stack, e.message)
  }
});
