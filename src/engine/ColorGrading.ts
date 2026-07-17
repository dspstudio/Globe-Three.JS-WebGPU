import { wgslFn } from 'three/tsl';

export const colorGradeWgsl = wgslFn(`
fn colorGrade(color: vec3<f32>, contrast: f32, saturation: f32, blackLevel: f32, blueGreenBoost: f32) -> vec3<f32> {
	// Contrast
	var c: vec3<f32> = (color - 0.5) * contrast + 0.5;
	
	// Saturation
	var luma: f32 = dot(c, vec3<f32>(0.299, 0.587, 0.114));
	c = mix(vec3<f32>(luma), c, vec3<f32>(saturation));
	
	// Deepen blacks
    c = max(c - vec3<f32>(blackLevel), vec3<f32>(0.0));
    // Soft shoulder for highlights
    // c = 1.0 - exp(-c);
	
	// Enhance blues and greens
	var bgBoost: vec3<f32> = vec3<f32>(1.0, 1.0 + blueGreenBoost * 0.5, 1.0 + blueGreenBoost);
	c = c * bgBoost;
	
	return c;
}
`);

export const vignetteWgsl = wgslFn(`
fn applyVignette(color: vec3<f32>, uv: vec2<f32>, darkness: f32, offset: f32) -> vec3<f32> {
    var d: vec2<f32> = abs(uv - 0.5) * 2.0;
    var dist: f32 = length(d);
    var v: f32 = clamp(1.0 - dist * offset, 0.0, 1.0);
    return color * pow(v, darkness);
}
`);
