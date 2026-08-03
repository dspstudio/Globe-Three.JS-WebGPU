import { wgslFn, glslFn } from 'three/tsl';
import { CONSTANTS } from '../constants';

const colorGradeWgsl = wgslFn(`
fn colorGrade(color: vec3<f32>, contrast: f32, saturation: f32, blackLevel: f32, blueGreenBoost: f32) -> vec3<f32> {
	// Contrast
	var c: vec3<f32> = (color - 0.5) * contrast + 0.5;
	
	// Saturation
	var luma: f32 = dot(c, vec3<f32>(0.299, 0.587, 0.114));
	c = mix(vec3<f32>(luma), c, vec3<f32>(saturation));
	
	// Deepen blacks
    c = max(c - vec3<f32>(blackLevel), vec3<f32>(0.0));
	
	// Enhance blues and greens
	var bgBoost: vec3<f32> = vec3<f32>(1.0, 1.0 + blueGreenBoost * 0.5, 1.0 + blueGreenBoost);
	c = c * bgBoost;
	
	return c;
}
`);

const colorGradeGlsl = glslFn(`
vec3 colorGrade(vec3 color, float contrast, float saturation, float blackLevel, float blueGreenBoost) {
	vec3 c = (color - 0.5) * contrast + 0.5;
	float luma = dot(c, vec3(0.299, 0.587, 0.114));
	c = mix(vec3(luma), c, vec3(saturation));
    c = max(c - vec3(blackLevel), vec3(0.0));
	vec3 bgBoost = vec3(1.0, 1.0 + blueGreenBoost * 0.5, 1.0 + blueGreenBoost);
	c = c * bgBoost;
	return c;
}
`);

export function colorGradeShader(args: any) {
  if (CONSTANTS.RENDER_TYPE === 'webgpu') {
    return colorGradeWgsl(args as any);
  } else {
    return colorGradeGlsl(args as any);
  }
}

const vignetteWgsl = wgslFn(`
fn applyVignette(color: vec3<f32>, uv: vec2<f32>, darkness: f32, offset: f32) -> vec3<f32> {
    var d: vec2<f32> = abs(uv - 0.5) * 2.0;
    var dist: f32 = length(d);
    var v: f32 = clamp(1.0 - dist * offset, 0.0, 1.0);
    return color * pow(v, darkness);
}
`);

const vignetteGlsl = glslFn(`
vec3 applyVignette(vec3 color, vec2 uv, float darkness, float offset) {
    vec2 d = abs(uv - 0.5) * 2.0;
    float dist = length(d);
    float v = clamp(1.0 - dist * offset, 0.0, 1.0);
    return color * pow(v, darkness);
}
`);

export function vignetteShader(args: any) {
  if (CONSTANTS.RENDER_TYPE === 'webgpu') {
    return vignetteWgsl(args as any);
  } else {
    return vignetteGlsl(args as any);
  }
}

const gtUchimuraWgsl = wgslFn(`
fn gtUchimura(color: vec3<f32>, exposure: f32) -> vec3<f32> {
    var x: vec3<f32> = color * exposure;
    var P: f32 = 1.0;
    var a: f32 = 1.0;
    var m: f32 = 0.22;
    var l: f32 = 0.4;
    var c: f32 = 1.33;
    var b: f32 = 0.0;

    var l0: f32 = ((P - m) * l) / a;
    var S0: f32 = m + l0;
    var S1: f32 = m + a * l0;
    var C2: f32 = (a * P) / (P - S1);

    var T_vec: vec3<f32> = vec3<f32>(m) * pow(clamp(x / m, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(c));
    var L_vec: vec3<f32> = vec3<f32>(m) + a * (x - vec3<f32>(m));
    var S_vec: vec3<f32> = vec3<f32>(P) - vec3<f32>(P - S1) * exp(-C2 * (x - vec3<f32>(S0)) / P);

    var w0: vec3<f32> = vec3<f32>(1.0) - step(vec3<f32>(m), x);
    var w2: vec3<f32> = step(vec3<f32>(S0), x);
    var w1: vec3<f32> = vec3<f32>(1.0) - w0 - w2;

    return clamp(vec3<f32>(b) + w0 * T_vec + w1 * L_vec + w2 * S_vec, vec3<f32>(0.0), vec3<f32>(1.0));
}
`);

const gtUchimuraGlsl = glslFn(`
vec3 gtUchimura(vec3 color, float exposure) {
    vec3 x = color * exposure;
    float P = 1.0;
    float a = 1.0;
    float m = 0.22;
    float l = 0.4;
    float c = 1.33;
    float b = 0.0;

    float l0 = ((P - m) * l) / a;
    float S0 = m + l0;
    float S1 = m + a * l0;
    float C2 = (a * P) / (P - S1);

    vec3 T_vec = vec3(m) * pow(clamp(x / m, vec3(0.0), vec3(1.0)), vec3(c));
    vec3 L_vec = vec3(m) + a * (x - vec3(m));
    vec3 S_vec = vec3(P) - vec3(P - S1) * exp(-C2 * (x - vec3(S0)) / P);

    vec3 w0 = vec3(1.0) - step(vec3(m), x);
    vec3 w2 = step(vec3(S0), x);
    vec3 w1 = vec3(1.0) - w0 - w2;

    return clamp(vec3(b) + w0 * T_vec + w1 * L_vec + w2 * S_vec, vec3(0.0), vec3(1.0));
}
`);

export function gtUchimuraShader(args: any) {
  if (CONSTANTS.RENDER_TYPE === 'webgpu') {
    return gtUchimuraWgsl(args as any);
  } else {
    return gtUchimuraGlsl(args as any);
  }
}




