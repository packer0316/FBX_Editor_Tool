/******************************************************************************
 * Spine WebGL Runtime - Compiled from TypeScript sources
 * 
 * This module extends the spine namespace with WebGL rendering capabilities.
 *****************************************************************************/

(function (spine) {
    var webgl;
    (function (webgl) {
        // ============================================================================
        // ManagedWebGLRenderingContext
        // ============================================================================
        class ManagedWebGLRenderingContext {
            constructor(canvasOrContext, contextConfig = { alpha: true }) {
                this.restorables = [];
                if (canvasOrContext instanceof HTMLCanvasElement) {
                    let canvas = canvasOrContext;
                    this.gl = canvas.getContext("webgl", contextConfig) || canvas.getContext("experimental-webgl", contextConfig);
                    this.canvas = canvas;
                    canvas.addEventListener("webglcontextlost", (e) => {
                        if (e) e.preventDefault();
                    });
                    canvas.addEventListener("webglcontextrestored", (e) => {
                        for (let i = 0, n = this.restorables.length; i < n; i++) {
                            this.restorables[i].restore();
                        }
                    });
                } else {
                    this.gl = canvasOrContext;
                    this.canvas = this.gl.canvas;
                }
            }
            addRestorable(restorable) {
                this.restorables.push(restorable);
            }
            removeRestorable(restorable) {
                let index = this.restorables.indexOf(restorable);
                if (index > -1) this.restorables.splice(index, 1);
            }
        }
        webgl.ManagedWebGLRenderingContext = ManagedWebGLRenderingContext;

        // ============================================================================
        // GLTexture
        // ============================================================================
        class GLTexture extends spine.Texture {
            constructor(context, image, useMipMaps = false) {
                super(image);
                this.texture = null;
                this.boundUnit = 0;
                this.useMipMaps = false;
                this.context = context instanceof ManagedWebGLRenderingContext ? context : new ManagedWebGLRenderingContext(context);
                this.useMipMaps = useMipMaps;
                this.restore();
                this.context.addRestorable(this);
            }
            setFilters(minFilter, magFilter) {
                let gl = this.context.gl;
                this.bind();
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GLTexture.validateMagFilter(magFilter));
            }
            static validateMagFilter(magFilter) {
                switch (magFilter) {
                    case spine.TextureFilter.MipMap:
                    case spine.TextureFilter.MipMapLinearLinear:
                    case spine.TextureFilter.MipMapLinearNearest:
                    case spine.TextureFilter.MipMapNearestLinear:
                    case spine.TextureFilter.MipMapNearestNearest:
                        return spine.TextureFilter.Linear;
                    default:
                        return magFilter;
                }
            }
            setWraps(uWrap, vWrap) {
                let gl = this.context.gl;
                this.bind();
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, uWrap);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, vWrap);
            }
            update(useMipMaps) {
                let gl = this.context.gl;
                if (!this.texture) {
                    this.texture = this.context.gl.createTexture();
                }
                this.bind();
                // 使用預乘 alpha 上傳，配合 ONE, ONE_MINUS_SRC_ALPHA 混合
                // 這樣 Additive 模式 (ONE, ONE) 中，黑色區域會正確變成透明
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, useMipMaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                if (useMipMaps) gl.generateMipmap(gl.TEXTURE_2D);
            }
            restore() {
                this.texture = null;
                this.update(this.useMipMaps);
            }
            bind(unit = 0) {
                let gl = this.context.gl;
                this.boundUnit = unit;
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
            }
            unbind() {
                let gl = this.context.gl;
                gl.activeTexture(gl.TEXTURE0 + this.boundUnit);
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
            dispose() {
                this.context.removeRestorable(this);
                let gl = this.context.gl;
                gl.deleteTexture(this.texture);
            }
        }
        GLTexture.DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL = false;
        webgl.GLTexture = GLTexture;

        // ============================================================================
        // Shader
        // ============================================================================
        class Shader {
            constructor(context, vertexShader, fragmentShader) {
                this.vertexShader = vertexShader;
                this.fragmentShader = fragmentShader;
                this.vs = null;
                this.fs = null;
                this.program = null;
                this.tmp2x2 = new Float32Array(2 * 2);
                this.tmp3x3 = new Float32Array(3 * 3);
                this.tmp4x4 = new Float32Array(4 * 4);
                this.vsSource = vertexShader;
                this.fsSource = fragmentShader;
                this.context = context instanceof ManagedWebGLRenderingContext ? context : new ManagedWebGLRenderingContext(context);
                this.context.addRestorable(this);
                this.compile();
            }
            getProgram() { return this.program; }
            compile() {
                let gl = this.context.gl;
                try {
                    this.vs = this.compileShader(gl.VERTEX_SHADER, this.vertexShader);
                    this.fs = this.compileShader(gl.FRAGMENT_SHADER, this.fragmentShader);
                    this.program = this.compileProgram(this.vs, this.fs);
                } catch (e) {
                    this.dispose();
                    throw e;
                }
            }
            compileShader(type, source) {
                let gl = this.context.gl;
                let shader = gl.createShader(type);
                if (!shader) throw new Error("Couldn't create shader.");
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    let error = "Couldn't compile shader: " + gl.getShaderInfoLog(shader);
                    gl.deleteShader(shader);
                    throw new Error(error);
                }
                return shader;
            }
            compileProgram(vs, fs) {
                let gl = this.context.gl;
                let program = gl.createProgram();
                if (!program) throw new Error("Couldn't create program.");
                gl.attachShader(program, vs);
                gl.attachShader(program, fs);
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    let error = "Couldn't link program: " + gl.getProgramInfoLog(program);
                    gl.deleteProgram(program);
                    throw new Error(error);
                }
                return program;
            }
            restore() {
                this.compile();
            }
            bind() {
                this.context.gl.useProgram(this.program);
            }
            unbind() {
                this.context.gl.useProgram(null);
            }
            setUniformi(uniform, value) {
                this.context.gl.uniform1i(this.getUniformLocation(uniform), value);
            }
            setUniformf(uniform, value) {
                this.context.gl.uniform1f(this.getUniformLocation(uniform), value);
            }
            setUniform2f(uniform, value, value2) {
                this.context.gl.uniform2f(this.getUniformLocation(uniform), value, value2);
            }
            setUniform3f(uniform, value, value2, value3) {
                this.context.gl.uniform3f(this.getUniformLocation(uniform), value, value2, value3);
            }
            setUniform4f(uniform, value, value2, value3, value4) {
                this.context.gl.uniform4f(this.getUniformLocation(uniform), value, value2, value3, value4);
            }
            setUniform4x4f(uniform, value) {
                let gl = this.context.gl;
                this.tmp4x4.set(value);
                gl.uniformMatrix4fv(this.getUniformLocation(uniform), false, this.tmp4x4);
            }
            getUniformLocation(uniform) {
                let gl = this.context.gl;
                return gl.getUniformLocation(this.program, uniform);
            }
            getAttributeLocation(attribute) {
                let gl = this.context.gl;
                return gl.getAttribLocation(this.program, attribute);
            }
            dispose() {
                this.context.removeRestorable(this);
                let gl = this.context.gl;
                if (this.vs) {
                    gl.deleteShader(this.vs);
                    this.vs = null;
                }
                if (this.fs) {
                    gl.deleteShader(this.fs);
                    this.fs = null;
                }
                if (this.program) {
                    gl.deleteProgram(this.program);
                    this.program = null;
                }
            }
            static newTwoColoredTextured(context) {
                let vs = `
                    attribute vec4 a_position;
                    attribute vec4 a_color;
                    attribute vec4 a_color2;
                    attribute vec2 a_texCoords;
                    uniform mat4 u_projTrans;
                    varying vec4 v_light;
                    varying vec4 v_dark;
                    varying vec2 v_texCoords;

                    void main () {
                        v_light = a_color;
                        v_dark = a_color2;
                        v_texCoords = a_texCoords;
                        gl_Position = u_projTrans * a_position;
                    }
                `;
                let fs = `
                    #ifdef GL_ES
                        #define LOWP lowp
                        precision mediump float;
                    #else
                        #define LOWP
                    #endif
                    varying LOWP vec4 v_light;
                    varying LOWP vec4 v_dark;
                    varying vec2 v_texCoords;
                    uniform sampler2D u_texture;

                    void main () {
                        vec4 texColor = texture2D(u_texture, v_texCoords);
                        
                        // 計算 RGB（使用 Two Color Tint 公式）
                        vec3 rgb = ((texColor.a - 1.0) * v_dark.a + 1.0 - texColor.rgb) * v_dark.rgb + texColor.rgb * v_light.rgb;
                        
                        // 計算最終 alpha
                        float finalAlpha = texColor.a * v_light.a;
                        
                        // 預乘 alpha
                        // 對於 Additive 混合 (ONE, ONE)，黑色 (0,0,0) 加上任何顏色都不會改變顏色
                        // 所以黑色區域自然就不會影響背景，前提是 Canvas 背景是完全透明的
                        gl_FragColor.rgb = rgb * finalAlpha;
                        gl_FragColor.a = finalAlpha;
                    }
                `;
                return new Shader(context, vs, fs);
            }
        }
        Shader.MVP_MATRIX = "u_projTrans";
        Shader.POSITION = "a_position";
        Shader.COLOR = "a_color";
        Shader.COLOR2 = "a_color2";
        Shader.TEXCOORDS = "a_texCoords";
        Shader.SAMPLER = "u_texture";
        webgl.Shader = Shader;

        // ============================================================================
        // VertexAttribute
        // ============================================================================
        class VertexAttribute {
            constructor(name, type, numElements) {
                this.name = name;
                this.type = type;
                this.numElements = numElements;
            }
        }
        webgl.VertexAttribute = VertexAttribute;

        class Position2Attribute extends VertexAttribute {
            constructor() {
                super(Shader.POSITION, 0, 2);
            }
        }
        webgl.Position2Attribute = Position2Attribute;

        class ColorAttribute extends VertexAttribute {
            constructor() {
                super(Shader.COLOR, 0, 4);
            }
        }
        webgl.ColorAttribute = ColorAttribute;

        class TexCoordAttribute extends VertexAttribute {
            constructor(unit = 0) {
                super(Shader.TEXCOORDS + (unit == 0 ? "" : unit), 0, 2);
            }
        }
        webgl.TexCoordAttribute = TexCoordAttribute;

        class Color2Attribute extends VertexAttribute {
            constructor() {
                super(Shader.COLOR2, 0, 4);
            }
        }
        webgl.Color2Attribute = Color2Attribute;

        // ============================================================================
        // Mesh
        // ============================================================================
        class Mesh {
            constructor(context, attributes, maxVertices, maxIndices) {
                this.attributes = attributes;
                this.verticesBuffer = null;
                this.verticesLength = 0;
                this.dirtyVertices = false;
                this.indicesBuffer = null;
                this.indicesLength = 0;
                this.dirtyIndices = false;
                this.elementsPerVertex = 0;
                this.context = context instanceof ManagedWebGLRenderingContext ? context : new ManagedWebGLRenderingContext(context);
                this.elementsPerVertex = 0;
                for (let i = 0; i < attributes.length; i++) {
                    this.elementsPerVertex += attributes[i].numElements;
                }
                this.vertices = new Float32Array(maxVertices * this.elementsPerVertex);
                this.indices = new Uint16Array(maxIndices);
                this.context.addRestorable(this);
            }
            getAttributes() { return this.attributes; }
            maxVertices() { return this.vertices.length / this.elementsPerVertex; }
            numVertices() { return this.verticesLength / this.elementsPerVertex; }
            setVerticesLength(length) {
                this.dirtyVertices = true;
                this.verticesLength = length;
            }
            getVertices() { return this.vertices; }
            maxIndices() { return this.indices.length; }
            numIndices() { return this.indicesLength; }
            setIndicesLength(length) {
                this.dirtyIndices = true;
                this.indicesLength = length;
            }
            getIndices() { return this.indices; }
            draw(shader, primitiveType) {
                this.drawWithOffset(shader, primitiveType, 0, this.indicesLength > 0 ? this.indicesLength : this.verticesLength / this.elementsPerVertex);
            }
            drawWithOffset(shader, primitiveType, offset, count) {
                let gl = this.context.gl;
                if (this.dirtyVertices || this.dirtyIndices) this.update();
                this.bind(shader);
                if (this.indicesLength > 0) {
                    gl.drawElements(primitiveType, count, gl.UNSIGNED_SHORT, offset * 2);
                } else {
                    gl.drawArrays(primitiveType, offset, count);
                }
                this.unbind(shader);
            }
            bind(shader) {
                let gl = this.context.gl;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuffer);
                let offset = 0;
                for (let i = 0; i < this.attributes.length; i++) {
                    let attrib = this.attributes[i];
                    let location = shader.getAttributeLocation(attrib.name);
                    gl.enableVertexAttribArray(location);
                    gl.vertexAttribPointer(location, attrib.numElements, gl.FLOAT, false, this.elementsPerVertex * 4, offset * 4);
                    offset += attrib.numElements;
                }
                if (this.indicesLength > 0) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
            }
            unbind(shader) {
                let gl = this.context.gl;
                for (let i = 0; i < this.attributes.length; i++) {
                    let attrib = this.attributes[i];
                    let location = shader.getAttributeLocation(attrib.name);
                    gl.disableVertexAttribArray(location);
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                if (this.indicesLength > 0) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            }
            update() {
                let gl = this.context.gl;
                if (this.dirtyVertices) {
                    if (!this.verticesBuffer) {
                        this.verticesBuffer = gl.createBuffer();
                    }
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.subarray(0, this.verticesLength), gl.DYNAMIC_DRAW);
                    this.dirtyVertices = false;
                }
                if (this.dirtyIndices) {
                    if (!this.indicesBuffer) {
                        this.indicesBuffer = gl.createBuffer();
                    }
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices.subarray(0, this.indicesLength), gl.DYNAMIC_DRAW);
                    this.dirtyIndices = false;
                }
            }
            restore() {
                this.verticesBuffer = null;
                this.indicesBuffer = null;
                this.update();
            }
            dispose() {
                this.context.removeRestorable(this);
                let gl = this.context.gl;
                gl.deleteBuffer(this.verticesBuffer);
                gl.deleteBuffer(this.indicesBuffer);
            }
        }
        webgl.Mesh = Mesh;

        // ============================================================================
        // PolygonBatcher
        // ============================================================================
        class PolygonBatcher {
            constructor(context, twoColorTint = true, maxVertices = 10920) {
                this.drawCalls = 0;
                this.isDrawing = false;
                this.shader = null;
                this.lastTexture = null;
                this.verticesLength = 0;
                this.indicesLength = 0;
                if (maxVertices > 10920) throw new Error("Can't have more than 10920 triangles per batch: " + maxVertices);
                this.context = context instanceof ManagedWebGLRenderingContext ? context : new ManagedWebGLRenderingContext(context);
                let attributes = twoColorTint
                    ? [new Position2Attribute(), new ColorAttribute(), new TexCoordAttribute(), new Color2Attribute()]
                    : [new Position2Attribute(), new ColorAttribute(), new TexCoordAttribute()];
                this.mesh = new Mesh(context, attributes, maxVertices, maxVertices * 3);
                let gl = this.context.gl;
                // 使用預乘 alpha 的混合模式作為初始值
                this.srcBlend = gl.ONE;
                this.dstBlend = gl.ONE_MINUS_SRC_ALPHA;
            }
            begin(shader) {
                let gl = this.context.gl;
                if (this.isDrawing) throw new Error("PolygonBatch is already drawing.");
                this.drawCalls = 0;
                this.shader = shader;
                this.lastTexture = null;
                this.isDrawing = true;
                gl.enable(gl.BLEND);
                gl.blendFunc(this.srcBlend, this.dstBlend);
            }
            setBlendMode(srcBlend, dstBlend) {
                let gl = this.context.gl;
                this.srcBlend = srcBlend;
                this.dstBlend = dstBlend;
                if (this.isDrawing) {
                    this.flush();
                    // 關鍵修復：使用 blendFuncSeparate 分別設置 RGB 和 Alpha 的混合
                    // 對於 Additive 混合 (ONE, ONE)：
                    // - RGB：ONE, ONE（顏色相加，黑色不影響背景）
                    // - Alpha：ZERO, ONE（不寫入源 alpha，保持背景 alpha）
                    // 這樣黑色區域的 alpha 就不會被寫入 Canvas，避免黑底
                    if (srcBlend === gl.ONE && dstBlend === gl.ONE) {
                        // Additive 混合：alpha 使用 ZERO, ONE
                        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
                    } else {
                        // 其他混合模式：RGB 和 alpha 使用相同設置
                        gl.blendFunc(this.srcBlend, this.dstBlend);
                    }
                }
            }
            draw(texture, vertices, indices) {
                if (texture != this.lastTexture) {
                    this.flush();
                    this.lastTexture = texture;
                } else if (this.verticesLength + vertices.length > this.mesh.getVertices().length ||
                    this.indicesLength + indices.length > this.mesh.getIndices().length) {
                    this.flush();
                }
                let indexStart = this.mesh.numVertices();
                this.mesh.getVertices().set(vertices, this.verticesLength);
                this.verticesLength += vertices.length;
                this.mesh.setVerticesLength(this.verticesLength);

                let indicesArray = this.mesh.getIndices();
                for (let i = this.indicesLength, j = 0; j < indices.length; i++, j++)
                    indicesArray[i] = indices[j] + indexStart;
                this.indicesLength += indices.length;
                this.mesh.setIndicesLength(this.indicesLength);
            }
            flush() {
                let gl = this.context.gl;
                if (this.verticesLength == 0) return;
                this.lastTexture.bind();
                this.mesh.draw(this.shader, gl.TRIANGLES);
                this.verticesLength = 0;
                this.indicesLength = 0;
                this.mesh.setVerticesLength(0);
                this.mesh.setIndicesLength(0);
                this.drawCalls++;
            }
            end() {
                let gl = this.context.gl;
                if (!this.isDrawing) throw new Error("PolygonBatch is not drawing.");
                if (this.verticesLength > 0 || this.indicesLength > 0) this.flush();
                this.shader = null;
                this.lastTexture = null;
                this.isDrawing = false;
                gl.disable(gl.BLEND);
            }
            getDrawCalls() { return this.drawCalls; }
            dispose() {
                this.mesh.dispose();
            }
        }
        webgl.PolygonBatcher = PolygonBatcher;

        // ============================================================================
        // Matrix4
        // ============================================================================
        class Matrix4 {
            constructor() {
                this.temp = new Float32Array(16);
                this.values = new Float32Array(16);
                let v = this.values;
                v[0] = 1; v[4] = 0; v[8] = 0; v[12] = 0;
                v[1] = 0; v[5] = 1; v[9] = 0; v[13] = 0;
                v[2] = 0; v[6] = 0; v[10] = 1; v[14] = 0;
                v[3] = 0; v[7] = 0; v[11] = 0; v[15] = 1;
            }
            set(values) {
                this.values.set(values);
                return this;
            }
            identity() {
                let v = this.values;
                v[0] = 1; v[4] = 0; v[8] = 0; v[12] = 0;
                v[1] = 0; v[5] = 1; v[9] = 0; v[13] = 0;
                v[2] = 0; v[6] = 0; v[10] = 1; v[14] = 0;
                v[3] = 0; v[7] = 0; v[11] = 0; v[15] = 1;
                return this;
            }
            ortho2d(x, y, width, height) {
                return this.ortho(x, x + width, y, y + height, 0, 1);
            }
            ortho(left, right, bottom, top, near, far) {
                this.identity();
                let x_orth = 2 / (right - left);
                let y_orth = 2 / (top - bottom);
                let z_orth = -2 / (far - near);
                let tx = -(right + left) / (right - left);
                let ty = -(top + bottom) / (top - bottom);
                let tz = -(far + near) / (far - near);
                let v = this.values;
                v[0] = x_orth; v[1] = 0; v[2] = 0; v[3] = 0;
                v[4] = 0; v[5] = y_orth; v[6] = 0; v[7] = 0;
                v[8] = 0; v[9] = 0; v[10] = z_orth; v[11] = 0;
                v[12] = tx; v[13] = ty; v[14] = tz; v[15] = 1;
                return this;
            }
            translate(x, y, z) {
                let v = this.values;
                v[12] += v[0] * x + v[4] * y + v[8] * z;
                v[13] += v[1] * x + v[5] * y + v[9] * z;
                v[14] += v[2] * x + v[6] * y + v[10] * z;
                v[15] += v[3] * x + v[7] * y + v[11] * z;
                return this;
            }
            scale(x, y, z) {
                let v = this.values;
                v[0] *= x; v[1] *= x; v[2] *= x; v[3] *= x;
                v[4] *= y; v[5] *= y; v[6] *= y; v[7] *= y;
                v[8] *= z; v[9] *= z; v[10] *= z; v[11] *= z;
                return this;
            }
        }
        webgl.Matrix4 = Matrix4;

        // ============================================================================
        // SkeletonRenderer (關鍵：正確處理 BlendMode)
        // ============================================================================
        class SkeletonRenderer {
            constructor(context, twoColorTint = true) {
            // 使用預乘 alpha 流程，搭配 ONE, ONE_MINUS_SRC_ALPHA 混合
            this.premultipliedAlpha = true;
                this.tempColor = new spine.Color();
                this.tempColor2 = new spine.Color();
                this.vertexSize = 2 + 2 + 4;
                this.twoColorTint = false;
                this.twoColorTint = twoColorTint;
                if (twoColorTint) this.vertexSize += 4;
                this.vertices = spine.Utils.newFloatArray(this.vertexSize * 1024);
            }

            draw(batcher, skeleton, slotRangeStart = -1, slotRangeEnd = -1) {
                let premultipliedAlpha = this.premultipliedAlpha;
                let twoColorTint = this.twoColorTint;
                let blendMode = null;
                let vertexSize = twoColorTint ? 12 : 8;

                let drawOrder = skeleton.drawOrder;

                for (let i = 0, n = drawOrder.length; i < n; i++) {
                    let slot = drawOrder[i];
                    if (!slot.bone.active) continue;

                    let attachment = slot.getAttachment();
                    let texture = null;
                    let uvs = null;
                    let triangles = null;
                    let numFloats = 0;
                    let attachmentColor = null;

                    if (attachment instanceof spine.RegionAttachment) {
                        let region = attachment;
                        this.vertices = spine.Utils.newFloatArray(vertexSize * 4);
                        region.computeWorldVertices(slot.bone, this.vertices, 0, vertexSize);
                        triangles = SkeletonRenderer.QUAD_TRIANGLES;
                        uvs = region.uvs;
                        numFloats = vertexSize * 4;
                        texture = region.region.renderObject.texture;
                        attachmentColor = region.color;
                    } else if (attachment instanceof spine.MeshAttachment) {
                        let mesh = attachment;
                        let numVertices = mesh.worldVerticesLength >> 1;
                        numFloats = numVertices * vertexSize;
                        this.vertices = spine.Utils.newFloatArray(numFloats);
                        mesh.computeWorldVertices(slot, 0, mesh.worldVerticesLength, this.vertices, 0, vertexSize);
                        triangles = mesh.triangles;
                        uvs = mesh.uvs;
                        texture = mesh.region.renderObject.texture;
                        attachmentColor = mesh.color;
                    } else {
                        continue;
                    }

                    if (texture != null) {
                        let skeletonColor = skeleton.color;
                        let slotColor = slot.color;
                        let alpha = skeletonColor.a * slotColor.a * attachmentColor.a;
                        let color = this.tempColor;
                        
                        // 預乘 alpha：RGB 需要乘以 alpha
                        let multiplier = this.premultipliedAlpha ? alpha : 1;
                        color.set(
                            skeletonColor.r * slotColor.r * attachmentColor.r * multiplier,
                            skeletonColor.g * slotColor.g * attachmentColor.g * multiplier,
                            skeletonColor.b * slotColor.b * attachmentColor.b * multiplier,
                            alpha
                        );

                        let dark = this.tempColor2;
                        if (slot.darkColor == null) {
                            // 當 premultipliedAlpha = true 時，dark.a 應該是 1.0（根據 Spine 邏輯）
                            // dark.rgb 保持為 0（因為沒有 darkColor）
                            dark.set(0, 0, 0, premultipliedAlpha ? 1.0 : 0.0);
                        } else {
                            if (premultipliedAlpha) {
                                dark.r = slot.darkColor.r * alpha;
                                dark.g = slot.darkColor.g * alpha;
                                dark.b = slot.darkColor.b * alpha;
                            } else {
                                dark.setFromColor(slot.darkColor);
                            }
                            dark.a = premultipliedAlpha ? 1.0 : 0.0;
                        }

                        // 處理 BlendMode
                        let slotBlendMode = slot.data.blendMode;
                        if (slotBlendMode != blendMode) {
                            blendMode = slotBlendMode;
                            let blendModes = this.getBlendMode(blendMode);
                            batcher.setBlendMode(blendModes[0], blendModes[1]);
                        }

                        // 設定頂點數據
                        let verts = this.vertices;
                        if (twoColorTint) {
                            for (let v = 2, u = 0; v < numFloats; v += vertexSize, u += 2) {
                                verts[v] = color.r;
                                verts[v + 1] = color.g;
                                verts[v + 2] = color.b;
                                verts[v + 3] = color.a;
                                verts[v + 4] = uvs[u];
                                verts[v + 5] = uvs[u + 1];
                                verts[v + 6] = dark.r;
                                verts[v + 7] = dark.g;
                                verts[v + 8] = dark.b;
                                verts[v + 9] = dark.a;
                            }
                        } else {
                            for (let v = 2, u = 0; v < numFloats; v += vertexSize, u += 2) {
                                verts[v] = color.r;
                                verts[v + 1] = color.g;
                                verts[v + 2] = color.b;
                                verts[v + 3] = color.a;
                                verts[v + 4] = uvs[u];
                                verts[v + 5] = uvs[u + 1];
                            }
                        }

                        batcher.draw(texture, verts.slice(0, numFloats), triangles);
                    }
                }
            }

            // 關鍵：根據 BlendMode 返回正確的 WebGL 混合參數
            // 注意：使用預乘 alpha 的混合公式，因為某些環境會自動預乘
            getBlendMode(blendMode) {
                const gl = WebGLRenderingContext;
                        switch (blendMode) {
                            case spine.BlendMode.Normal:
                                // 預乘 alpha：ONE, ONE_MINUS_SRC_ALPHA
                                return [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                            case spine.BlendMode.Additive:
                                // 預乘加法：ONE, ONE（黑色會變透明）
                                return [gl.ONE, gl.ONE];
                            case spine.BlendMode.Multiply:
                                return [gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA];
                            case spine.BlendMode.Screen:
                                return [gl.ONE, gl.ONE_MINUS_SRC_COLOR];
                            default:
                                return [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                        }
            }
        }
        SkeletonRenderer.QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
        webgl.SkeletonRenderer = SkeletonRenderer;

    })(webgl = spine.webgl || (spine.webgl = {}));
})(spine || (spine = {}));

