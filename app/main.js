"use client";

import { useEffect, useRef, useState } from "react";

const SHADER_SOURCE = String.raw`struct Uniforms {
  frame: vec4f,
  pointer: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

struct TraceResult {
  hit: f32,
  distance: f32,
  worldPos: vec3f,
  localPos: vec3f,
}

const OBJECT_SCALE: f32 = 2.8;

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn smoothMax(a: f32, b: f32, radius: f32) -> f32 {
  let safeRadius = max(radius, 0.0001);
  let h = max(safeRadius - abs(a - b), 0.0) / safeRadius;
  return max(a, b) + h * h * safeRadius * 0.25;
}

fn rotate(point: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(c * point.x - s * point.y, s * point.x + c * point.y);
}

fn hash21(point: vec2f) -> f32 {
  let value = sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453123;
  return fract(value);
}

fn hash22(point: vec2f) -> vec2f {
  return vec2f(
    hash21(point),
    hash21(point + vec2f(41.0, 289.0))
  );
}

fn noise(point: vec2f) -> f32 {
  let cell = floor(point);
  let local = fract(point);
  let blend = local * local * (3.0 - 2.0 * local);

  let a = hash21(cell);
  let b = hash21(cell + vec2f(1.0, 0.0));
  let c = hash21(cell + vec2f(0.0, 1.0));
  let d = hash21(cell + vec2f(1.0, 1.0));

  let x1 = mix(a, b, blend.x);
  let x2 = mix(c, d, blend.x);
  return mix(x1, x2, blend.y);
}

fn fbm(point: vec2f) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequencyPoint = point;

  for (var octave = 0; octave < 5; octave = octave + 1) {
    value = value + amplitude * noise(frequencyPoint);
    frequencyPoint = rotate(frequencyPoint * 2.03, 0.55);
    amplitude = amplitude * 0.52;
  }

  return value;
}

fn voronoi(point: vec2f) -> vec2f {
  let cell = floor(point);
  let local = fract(point);

  var nearestVector = vec2f(0.0, 0.0);
  var minDistance = 9.0;

  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let offset = vec2f(f32(x), f32(y));
      let sample = hash22(cell + offset);
      let delta = offset + sample - local;
      let distanceSquared = dot(delta, delta);

      if (distanceSquared < minDistance) {
        minDistance = distanceSquared;
        nearestVector = delta;
      }
    }
  }

  var edgeDistance = 9.0;

  for (var y = -2; y <= 2; y = y + 1) {
    for (var x = -2; x <= 2; x = x + 1) {
      let offset = vec2f(f32(x), f32(y));
      let sample = hash22(cell + offset);
      let delta = offset + sample - local;
      let difference = delta - nearestVector;
      let separation = length(difference);

      if (separation > 0.0001) {
        let midpoint = 0.5 * (delta + nearestVector);
        edgeDistance = min(edgeDistance, dot(midpoint, difference / separation));
      }
    }
  }

  return vec2f(sqrt(minDistance), edgeDistance);
}

fn sdOnyxShape(point: vec2f) -> f32 {
  let angle = atan2(point.y, point.x);
  let contour = 1.0
    + 0.07 * sin(angle * 4.0 + 0.6)
    + 0.03 * sin(angle * 9.0 - 1.4)
    + 0.02 * sin((point.x - point.y) * 4.2);

  return length(point) - contour;
}

fn rotateX3(point: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return vec3f(point.x, c * point.y - s * point.z, s * point.y + c * point.z);
}

fn rotateY3(point: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return vec3f(c * point.x + s * point.z, point.y, -s * point.x + c * point.z);
}

fn objectLocalPosition(point: vec3f, pointer: vec2f) -> vec3f {
  let yaw = pointer.x * 0.34;
  let pitch = pointer.y * 0.26;
  return rotateX3(rotateY3(point, -yaw), -pitch) * OBJECT_SCALE;
}

fn organicRadius(direction: vec3f) -> f32 {
  let azimuth = atan2(direction.y, direction.x);
  let elevation = asin(clamp(direction.z, -1.0, 1.0));

  return 1.0
    + 0.08 * sin(azimuth * 3.0 + 0.6)
    + 0.035 * sin(azimuth * 7.0 - 1.4)
    + 0.06 * sin(elevation * 4.0 + 0.8)
    + 0.03 * sin((direction.x - direction.y) * 4.2);
}

fn sdOrganicCore(localPos: vec3f) -> f32 {
  let stretched = localPos / vec3f(0.84, 1.1, 0.72);
  let radius = max(length(stretched), 0.0001);
  let direction = stretched / radius;
  return radius - organicRadius(direction);
}

fn polyhedronDistance(localPos: vec3f) -> f32 {
  let q = localPos / vec3f(0.85, 1.12, 0.74);
  let planes = array<vec4f, 14>(
    vec4f(normalize(vec3f(0.0, 0.98, 0.42)), 0.97),
    vec4f(normalize(vec3f(0.72, 0.62, 0.39)), 0.96),
    vec4f(normalize(vec3f(-0.72, 0.62, 0.39)), 0.96),
    vec4f(normalize(vec3f(0.96, 0.06, 0.33)), 0.93),
    vec4f(normalize(vec3f(-0.96, 0.06, 0.33)), 0.93),
    vec4f(normalize(vec3f(0.72, -0.62, 0.39)), 0.95),
    vec4f(normalize(vec3f(-0.72, -0.62, 0.39)), 0.95),
    vec4f(normalize(vec3f(0.0, -0.98, 0.42)), 0.94),
    vec4f(normalize(vec3f(0.46, 0.78, -0.42)), 0.98),
    vec4f(normalize(vec3f(-0.46, 0.78, -0.42)), 0.98),
    vec4f(normalize(vec3f(0.46, -0.78, -0.42)), 0.98),
    vec4f(normalize(vec3f(-0.46, -0.78, -0.42)), 0.98),
    vec4f(normalize(vec3f(0.0, 0.0, 1.0)), 0.82),
    vec4f(normalize(vec3f(0.0, 0.0, -1.0)), 0.9)
  );

  var distance = -100.0;

  for (var index = 0; index < 14; index = index + 1) {
    let plane = planes[index];
    distance = max(distance, dot(q, plane.xyz) - plane.w);
  }

  return distance;
}

fn sdOnyxMeshLocal(localPos: vec3f) -> f32 {
  let organic = sdOrganicCore(localPos);
  let facets = polyhedronDistance(localPos);
  return smoothMax(organic - 0.055, facets, 0.09);
}

fn sceneDistance(worldPos: vec3f, pointer: vec2f) -> f32 {
  return sdOnyxMeshLocal(objectLocalPosition(worldPos, pointer)) / OBJECT_SCALE;
}

fn traceStone(rayOrigin: vec3f, rayDirection: vec3f, pointer: vec2f) -> TraceResult {
  var distance = 0.0;
  var hit = 0.0;
  var worldPos = rayOrigin;
  var localPos = objectLocalPosition(worldPos, pointer);

  for (var step = 0; step < 72; step = step + 1) {
    worldPos = rayOrigin + rayDirection * distance;
    localPos = objectLocalPosition(worldPos, pointer);

    let sceneStep = sdOnyxMeshLocal(localPos) / OBJECT_SCALE;

    if (sceneStep < 0.0015) {
      hit = 1.0;
      break;
    }

    distance = distance + sceneStep * 0.72;

    if (distance > 5.0) {
      break;
    }
  }

  return TraceResult(hit, distance, worldPos, localPos);
}

fn meshNormal(worldPos: vec3f, pointer: vec2f) -> vec3f {
  let epsilon = 0.0035;
  let gradient = vec3f(
    sceneDistance(worldPos + vec3f(epsilon, 0.0, 0.0), pointer)
      - sceneDistance(worldPos - vec3f(epsilon, 0.0, 0.0), pointer),
    sceneDistance(worldPos + vec3f(0.0, epsilon, 0.0), pointer)
      - sceneDistance(worldPos - vec3f(0.0, epsilon, 0.0), pointer),
    sceneDistance(worldPos + vec3f(0.0, 0.0, epsilon), pointer)
      - sceneDistance(worldPos - vec3f(0.0, 0.0, epsilon), pointer)
  );

  return normalize(gradient);
}

fn projectedShadow(point: vec2f, pointer: vec2f) -> f32 {
  let shadowCenter = vec2f(0.0, -0.45 + abs(pointer.y) * 0.008);
  let shadowPoint = rotate(point - shadowCenter, pointer.x * 0.012);
  let footprint = length(shadowPoint / (vec2f(0.46, 0.28) / OBJECT_SCALE));
  let softness = 0.9;
  return 1.0 - smoothstep(0.3, 1.08 + softness, footprint);
}

fn sampleOnyxTriplanar(localPos: vec3f, normal: vec3f, time: f32, pointer: vec2f) -> vec3f {
  let weights = pow(abs(normal), vec3f(5.0));
  let weightSum = max(weights.x + weights.y + weights.z, 0.0001);
  let xyPoint = (localPos.xy + localPos.z * vec2f(0.22, -0.16)) * 0.34;
  let xzPoint = (vec2f(localPos.x, localPos.z) + localPos.y * vec2f(-0.16, 0.11)) * 0.34;
  let yzPoint = (vec2f(localPos.y, localPos.z) + localPos.x * vec2f(0.12, -0.09)) * 0.34;

  return (
    onyxPattern(xyPoint, time, pointer) * weights.z
    + onyxPattern(xzPoint, time, pointer) * weights.y
    + onyxPattern(yzPoint, time, pointer) * weights.x
  ) / weightSum;
}

fn onyxPattern(point: vec2f, time: f32, pointer: vec2f) -> vec3f {
  let drift = vec2f(time * 0.045, -time * 0.032);
  let pointerWarp = pointer * 0.12;
  let swirlA = fbm(rotate(point * 1.8 + drift + pointerWarp, 0.35));
  let swirlB = fbm(rotate(point * 3.2 - drift * 1.4 - pointerWarp, -1.1));
  let warp = vec2f(swirlA - 0.5, swirlB - 0.5);
  let warpedPoint = point + warp * 0.52;
  let bandPoint = rotate(warpedPoint, 0.35 * sin(time * 0.11));

  let bands = 0.5 + 0.5 * sin(
    bandPoint.y * 22.0
    + fbm(bandPoint * 3.1 + vec2f(0.0, time * 0.06)) * 12.0
    - time * 0.55
  );
  let stripes = 0.5 + 0.5 * sin(
    (bandPoint.x * 0.85 + bandPoint.y * 1.25) * 18.0
    - fbm(bandPoint * 4.5 - vec2f(time * 0.04, 0.0)) * 9.5
    + time * 0.38
  );
  let rings = 0.5 + 0.5 * sin(
    length(warpedPoint * vec2f(1.4, 0.9) + warp * 0.5) * 19.0
    - time * 0.48
    + fbm(warpedPoint * 5.2) * 11.0
  );

  let plume = fbm(warpedPoint * 2.4 - vec2f(time * 0.08, -time * 0.02));
  let smoke = smoothstep(0.22, 0.85, plume);

  let cellData = voronoi(
    warpedPoint * 3.8
    + warp * 1.8
    + vec2f(time * 0.03, -time * 0.027)
  );
  let cells = 1.0 - smoothstep(0.0, 0.18, cellData.y);
  let islands = smoothstep(0.15, 0.8, 1.0 - cellData.x);

  let veinField = abs(
    sin(
      plume * 18.0
      + fbm(warpedPoint * 7.0 + warp * 2.0) * 10.0
      + warpedPoint.x * 5.5
      - time * 0.35
    )
  );
  let veins = smoothstep(0.82, 0.98, veinField);

  let phase = time * 0.22;
  let w0 = 0.45 + 0.55 * (0.5 + 0.5 * sin(phase));
  let w1 = 0.45 + 0.55 * (0.5 + 0.5 * sin(phase * 1.21 + 1.1));
  let w2 = 0.45 + 0.55 * (0.5 + 0.5 * sin(phase * 0.87 + 2.7));
  let w3 = 0.45 + 0.55 * (0.5 + 0.5 * sin(phase * 1.47 + 3.9));
  let w4 = 0.45 + 0.55 * (0.5 + 0.5 * sin(phase * 1.73 + 5.2));
  let weightSum = w0 + w1 + w2 + w3 + w4;

  let mineralField = (
    bands * w0
    + stripes * w1
    + rings * w2
    + islands * w3
    + smoke * w4
  ) / weightSum;

  let baseValue = mix(mineralField, plume, 0.35);

  var color = mix(
    vec3f(0.025, 0.026, 0.031),
    vec3f(0.15, 0.156, 0.172),
    smoothstep(0.08, 0.75, baseValue)
  );

  color = mix(
    color,
    vec3f(0.34, 0.35, 0.37),
    smoothstep(0.48, 0.92, smoke * mineralField + rings * 0.25)
  );
  color = mix(
    color,
    vec3f(0.56, 0.52, 0.44),
    0.12 * smoothstep(0.7, 0.98, stripes * smoke)
  );
  color = mix(color, vec3f(0.86, 0.86, 0.84), 0.45 * veins + 0.24 * cells);

  let glints = smoothstep(0.92, 0.99, noise(warpedPoint * 24.0 + vec2f(time * 0.05, 0.0)));
  return color + glints * 0.04;
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  var output: VertexOutput;
  let position = positions[vertexIndex];
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + 0.5;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let time = uniforms.frame.z;
  let aspect = uniforms.frame.w;
  let pointer = uniforms.pointer.xy;

  var point = input.uv * 2.0 - 1.0;
  point.x = point.x * aspect;
  let compositionOffset = vec2f(0.0, 0.1);
  let scenePoint = point - compositionOffset;

  let shadow = projectedShadow(scenePoint, pointer);
  let shadowAlpha = shadow * 0.11;
  var color = vec3f(0.018, 0.022, 0.03) * shadowAlpha;
  var alpha = shadowAlpha;

  let projectedRadius = length(scenePoint / (vec2f(0.98, 1.24) / OBJECT_SCALE));

  if (projectedRadius < 1.28) {
    let rayOrigin = vec3f(scenePoint, 2.55);
    let rayDirection = vec3f(0.0, 0.0, -1.0);
    let trace = traceStone(rayOrigin, rayDirection, pointer);

    if (trace.hit > 0.5) {
      let normal = meshNormal(trace.worldPos, pointer);
      let viewDirection = vec3f(0.0, 0.0, 1.0);
      let lightDirection = normalize(vec3f(-0.08, 0.9, 0.44));
      let fillDirection = normalize(vec3f(0.32, -0.18, 0.93));
      let diffuse = saturate(dot(normal, lightDirection));
      let fillDiffuse = saturate(dot(normal, fillDirection));
      let specular = pow(saturate(dot(normal, normalize(lightDirection + viewDirection))), 28.0);
      let fillSpecular = pow(saturate(dot(normal, normalize(fillDirection + viewDirection))), 18.0);

      let localPos = trace.localPos;
      let organic = sdOrganicCore(localPos) - 0.045;
      let facets = polyhedronDistance(localPos);
      let facetDominance = smoothstep(-0.035, 0.025, facets - organic);
      let frontness = saturate(dot(normal, viewDirection));
      let rim = pow(1.0 - frontness, 1.9);
      let crown = smoothstep(-0.2, 0.9, localPos.z);

      var stone = sampleOnyxTriplanar(localPos, normal, time, pointer);
      stone = stone * (
        0.52
        + 0.28 * diffuse
        + 0.14 * fillDiffuse
        + 0.1 * crown
      );
      stone = mix(stone, stone * 1.08, facetDominance * 0.08);
      stone = mix(stone, stone * 0.8, facetDominance * (1.0 - diffuse) * 0.22);
      stone = stone + vec3f(0.14, 0.13, 0.12) * rim * 0.34;
      stone = stone + vec3f(0.42, 0.425, 0.43) * specular * (0.18 + 0.34 * facetDominance);
      stone = stone + vec3f(0.2, 0.205, 0.21) * fillSpecular * 0.16;

      color = stone;
      alpha = 1.0;
    }
  }

  return vec4f(color, alpha);
}`;

async function loadShaderModule(device) {
  const shaderModule = device.createShaderModule({ code: SHADER_SOURCE });
  const info = await shaderModule.getCompilationInfo();
  const errors = info.messages.filter((message) => message.type === "error");

  if (errors.length > 0) {
    const formatted = errors
      .map((message) => `${message.lineNum}:${message.linePos} ${message.message}`)
      .join("\n");
    throw new Error(`WGSL compilation failed:\n${formatted}`);
  }

  return shaderModule;
}

export default function OnyxCanvas() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    let disposed = false;
    let context = null;

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      pointerRef.current.x = x * 2 - 1;
      pointerRef.current.y = (1 - y) * 2 - 1;
    };

    const handlePointerLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width === width && canvas.height === height) {
        return;
      }

      canvas.width = width;
      canvas.height = height;
    };

    async function init() {
      if (!("gpu" in navigator)) {
        throw new Error("This browser does not expose WebGPU. Try a WebGPU-capable browser.");
      }

      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      if (!adapter) {
        throw new Error("Unable to acquire a GPU adapter for this demo.");
      }

      const device = await adapter.requestDevice();
      context = canvas.getContext("webgpu");

      if (!context) {
        throw new Error("Unable to create a WebGPU canvas context.");
      }

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: "premultiplied",
      });

      const shaderModule = await loadShaderModule(device);
      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vsMain",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fsMain",
          targets: [{ format }],
        },
        primitive: {
          topology: "triangle-list",
        },
      });

      const uniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const uniforms = new Float32Array(8);

      device.lost.then((info) => {
        cancelAnimationFrame(animationFrameRef.current);

        if (!disposed) {
          setError(`GPU device lost: ${info.message}`);
        }
      });

      const frame = (now) => {
        if (disposed) {
          return;
        }

        resizeCanvas();

        uniforms[0] = canvas.width;
        uniforms[1] = canvas.height;
        uniforms[2] = now * 0.001;
        uniforms[3] = canvas.width / canvas.height;
        uniforms[4] = pointerRef.current.x;
        uniforms[5] = pointerRef.current.y;
        uniforms[6] = 0;
        uniforms[7] = 0;

        device.queue.writeBuffer(uniformBuffer, 0, uniforms);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameRef.current = requestAnimationFrame(frame);
      };

      setError("");
      animationFrameRef.current = requestAnimationFrame(frame);
    }

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    init().catch((nextError) => {
      console.error(nextError);

      if (!disposed) {
        setError(nextError.message);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameRef.current);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);

      if (context && typeof context.unconfigure === "function") {
        context.unconfigure();
      }
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="stage" aria-label="Animated onyx WebGPU shader" />
      {error ? <p className="status">{error}</p> : null}
    </>
  );
}
