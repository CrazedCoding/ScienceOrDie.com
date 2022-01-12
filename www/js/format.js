function getFormat() {
  function File() {}
  File.prototype = function() {
    this.name = ""
    this.data = ""
  }
  function OpenGLDimension() {
    this.type = ""
    this.value = ""
    this.Type = {
      UNSET: "",
      SCREEN_SIZE : "SCREEN_SIZE",
      NEXT_LOWEST_POWER_OF_TWO : "NEXT_LOWEST_POWER_OF_TWO",
      NEXT_HIGHEST_POWER_OF_TWO : "NEXT_HIGHEST_POWER_OF_TWO",
      EXACT : "EXACT"
    }
  }
  OpenGLDimension.prototype = function() {
  }
  function OpenGLUniform () {
    this.type = ""
    this.name = ""
    this.value = ""
    this.Type = {
      UNSET: "",
      FLOAT : "FLOAT",
      INT : "INT",
      BOOL : "BOOL",
      VEC_TWO : "VEC_TWO",
      VEC_THREE : "VEC_THREE",
      VEC_FOUR : "VEC_FOUR",
      IVEC_TWO : "IVEC_TWO",
      IVEC_THREE : "IVEC_THREE",
      IVEC_FOUR : "IVEC_FOUR",
      BVEC_TWO : "BVEC_TWO",
      BVEC_THREE : "BVEC_THREE",
      BVEC_FOUR : "BVEC_FOUR",
      MAT_TWO : "MAT_TWO",
      MAT_THREE : "MAT_THREE",
      MAT_FOUR : "MAT_FOUR",
      SAMPLER_TWO_D : "SAMPLER_TWO_D",
      SAMPLERCUBE : "SAMPLERCUBE"
    }
  }
  OpenGLUniform.prototype = function() {
  }

  function OpenGLContext() {
    this.name = ""
    this.width = new OpenGLDimension()
    this.height = new OpenGLDimension()
    this.depth_test = false
  }
  OpenGLContext.prototype = function() {
  }

  function OpenGLProgram() {
    this.name = ""
    this.uniforms = [new OpenGLUniform()]
    this.fragment = ""
    this.vertex = ""
  }
  OpenGLProgram.prototype = function() {
  }

  function OpenGLStage() {
    this.name = ""
    this.type = ""
    this.context = ""
    this.program = ""
    this.vertices = ""
    this.indices = ""
    this.Type = {
      UNSET: "",
      SHADER : "SHADER",
      MESH_POINTS : "MESH_POINTS",
      MESH_LINES : "MESH_LINES",
      MESH_LINE_STRIP : "MESH_LINE_STRIP",
      MESH_LINE_LOOP : "MESH_LINE_LOOP",
      MESH_TRIANGLES : "MESH_TRIANGLES",
      MESH_TRIANGLE_FAN : "MESH_TRIANGLE_FAN",
      MESH_TRIANGLE_STRIP : "MESH_TRIANGLE_STRIP"
    }
  }
  OpenGLStage.prototype = function() {
  }

  function OpenGLPipeline() {
    this.contexts = [new OpenGLContext()]
    this.programs = [new OpenGLProgram()]
    this.stages = [new OpenGLStage()]
  }
  OpenGLPipeline.prototype = function() {
  }

  function Algorithm() {
    this.name = ""
    this.description = ""
    this.created = ""
    this.views = 0
    this.featured = false
    this.featured = false
    this.thumbnail = ""
    this.public = false
    this.html = ""
    this.client = ""
    this.files = [new File()]
    this.pipeline = new OpenGLPipeline()
    this.created = ""
    this.edited = ""
  }
  Algorithm.prototype = function() {
  }

  return {
File: new File(),
OpenGLDimension: new OpenGLDimension(),
OpenGLUniform: new OpenGLUniform(),
OpenGLContext: new OpenGLContext(),
OpenGLProgram: new OpenGLProgram(),
OpenGLStage: new OpenGLStage(),
OpenGLPipeline: new OpenGLPipeline()
  }
  // Format.format = function(obj) {
  //   const final = {}
  //   for(const format in Format) {
  //     if()
  //     for(const key in Format.Algorithm) {
  //       if(typeof Format[key] === "string" && typeof obj[key] === "string") final[key].prototype = obj[key]
  //       else if(typeof Algorithm[key] === "boolean" && typeof obj[key] === "boolean") final[key].prototype =  obj[key]
  //       else if(typeof Array.isArray(Algorithm[key]) && Array.isArray(obj[key])) final[key].prototype = obj[key].map(Format.clean)
  //       else if(typeof Algorithm[key] === "object" && typeof obj[key] === "object") final[key].prototype = Format.clean(obj[key])
  //     }
  //   }
  // }
}
const Format = getFormat()