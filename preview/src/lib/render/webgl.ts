import type { DisplayInstance, LmbJson } from "../lmb/types";
import { ResourceStore } from "../lmb/store";

interface LoadedTexture {
  atlasId: number;
  width: number;
  height: number;
  texture: WebGLTexture;
}

/**
 * WebGL renderer for LMB display instances.
 * Renders textured meshes with color multiply/add and blend modes.
 */
export class WebGlRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionLocation: number;
  private uvLocation: number;
  private matrixLocation: WebGLUniformLocation;
  private colorMultLocation: WebGLUniformLocation;
  private colorAddLocation: WebGLUniformLocation;
  private textureLocation: WebGLUniformLocation;
  private vertexBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;
  private currentAtlasTexture: WebGLTexture | null = null;
  private textureByAtlasId = new Map<number, LoadedTexture>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL is not supported");
    this.gl = gl;

    this.program = this.createProgram();
    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.uvLocation = gl.getAttribLocation(this.program, "a_uv");

    const matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    const colorMultLocation = gl.getUniformLocation(this.program, "u_colorMult");
    const colorAddLocation = gl.getUniformLocation(this.program, "u_colorAdd");
    const textureLocation = gl.getUniformLocation(this.program, "u_texture");
    if (!matrixLocation || !colorMultLocation || !colorAddLocation || !textureLocation) {
      throw new Error("Failed to get shader uniform locations");
    }
    this.matrixLocation = matrixLocation;
    this.colorMultLocation = colorMultLocation;
    this.colorAddLocation = colorAddLocation;
    this.textureLocation = textureLocation;

    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !indexBuffer) {
      throw new Error("Failed to create WebGL buffers");
    }
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;

    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.enableVertexAttribArray(this.uvLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(this.uvLocation, 2, gl.FLOAT, false, 16, 8);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  resizeForMeta(meta: LmbJson["meta"]): void {
    const width = meta.width || 512;
    const height = meta.height || 256;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Load atlas textures using a configurable path pattern.
   * @param json        The LMB JSON data
   * @param _store      Resource store (reserved for future use)
   * @param basePath    Base path prefix for texture files
   * @param namePattern Function that maps atlas index to filename.
   *                    Defaults to "img-XXXXX.png" sequential naming.
   */
  async loadAtlasTextures(
    json: LmbJson,
    _store: ResourceStore,
    basePath: string = "",
    namePattern?: (index: number, atlasName?: string) => string
  ): Promise<void> {
    this.textureByAtlasId.clear();
    const atlases = json.resources.textureAtlases;

    const defaultPattern = (index: number) =>
      `img-${String(index).padStart(5, "0")}.png`;

    for (let i = 0; i < atlases.length; i++) {
      const atlas = atlases[i];
      const fileName = namePattern
        ? namePattern(i, atlas.name)
        : defaultPattern(i);
      const url = basePath
        ? `${basePath.replace(/\/+$/, "")}/${fileName}`
        : fileName;

      try {
        const image = await this.loadImage(url);
        const texture = this.createTextureFromImage(image);
        this.textureByAtlasId.set(atlas.id, {
          atlasId: atlas.id,
          width: atlas.width,
          height: atlas.height,
          texture,
        });
      } catch (e) {
        console.error(
          `Failed to load texture for atlas ${atlas.id} (${fileName}):`,
          e
        );
      }
    }
  }

  clear(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  renderScene(instances: DisplayInstance[]): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    for (const instance of instances) {
      const graphic = instance.graphic;
      if (!graphic) continue;

      const atlasBinding = this.textureByAtlasId.get(graphic.atlasId);
      if (!atlasBinding) continue;

      if (this.currentAtlasTexture !== atlasBinding.texture) {
        this.currentAtlasTexture = atlasBinding.texture;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.currentAtlasTexture);
        gl.uniform1i(this.textureLocation, 0);
      }

      const colorMult = instance.colorMult ?? {
        r: 256,
        g: 256,
        b: 256,
        a: 256,
      };
      const colorAdd = instance.colorAdd ?? { r: 0, g: 0, b: 0, a: 0 };
      gl.uniform4f(
        this.colorMultLocation,
        colorMult.r / 256.0,
        colorMult.g / 256.0,
        colorMult.b / 256.0,
        colorMult.a / 256.0
      );
      gl.uniform4f(
        this.colorAddLocation,
        colorAdd.r / 256.0,
        colorAdd.g / 256.0,
        colorAdd.b / 256.0,
        colorAdd.a / 256.0
      );

      const m = instance.transform;
      const matrix = this.buildOrthoMatrix(
        this.canvas.width,
        this.canvas.height,
        m
      );
      gl.uniformMatrix3fv(this.matrixLocation, false, matrix);

      const vertexData = new Float32Array(graphic.vertices.length * 4);
      for (let vi = 0; vi < graphic.vertices.length; vi++) {
        const v = graphic.vertices[vi];
        const offset = vi * 4;
        vertexData[offset] = v.x;
        vertexData[offset + 1] = v.y;
        vertexData[offset + 2] = v.u;
        vertexData[offset + 3] = v.v;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STREAM_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(graphic.indices),
        gl.STREAM_DRAW
      );
      gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(this.uvLocation, 2, gl.FLOAT, false, 16, 8);

      this.setBlendMode(instance.blendMode);
      gl.drawElements(
        gl.TRIANGLES,
        graphic.indices.length,
        gl.UNSIGNED_SHORT,
        0
      );
    }
  }

  private setBlendMode(mode: string): void {
    const gl = this.gl;
    switch (mode.toLowerCase()) {
      case "add":
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
        break;
      case "multiply":
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case "screen":
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        break;
      case "subtract":
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
        gl.blendFunc(gl.ONE, gl.ONE);
        break;
      case "normal":
      default:
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA
        );
        break;
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private createTextureFromImage(image: HTMLImageElement): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create WebGL texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
      gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  }

  private createProgram(): WebGLProgram {
    const gl = this.gl;
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_uv;
      varying vec2 v_uv;
      uniform mat3 u_matrix;
      void main() {
        vec3 pos = u_matrix * vec3(a_position.xy, 1.0);
        gl_Position = vec4(pos.xy, 0.0, 1.0);
        v_uv = a_uv;
      }
    `;
    const fsSource = `
      precision mediump float;
      varying vec2 v_uv;
      uniform sampler2D u_texture;
      uniform vec4 u_colorMult;
      uniform vec4 u_colorAdd;
      void main() {
        vec4 texColor = texture2D(u_texture, v_uv);
        vec4 color = texColor * u_colorMult + u_colorAdd;
        gl_FragColor = color;
      }
    `;

    const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create WebGL program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log =
        gl.getProgramInfoLog(program) || "Unknown program link error";
      gl.deleteProgram(program);
      throw new Error(log);
    }
    return program;
  }

  private buildOrthoMatrix(
    stageWidth: number,
    stageHeight: number,
    m: { a: number; b: number; c: number; d: number; x: number; y: number }
  ): Float32Array {
    const sx = 2 / stageWidth;
    const sy = -2 / stageHeight;

    return new Float32Array([
      m.a * sx, m.b * sy, 0,
      m.c * sx, m.d * sy, 0,
      m.x * sx, m.y * sy, 1,
    ]);
  }
}
