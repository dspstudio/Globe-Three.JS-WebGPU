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



