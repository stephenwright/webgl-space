/** @file s.vert.glsl */

precision mediump float;

attribute vec3 v3_position;
attribute vec4 v4_color;
attribute vec2 v2_uv;

uniform mat4 m4_model;
uniform mat4 m4_view;
uniform mat4 m4_projection;

varying vec3 _v3_position;
varying vec4 _v4_color;
//varying vec2 _v2_uv;

void main(void) { 
	mat4 mvp = m4_projection * m4_view * m4_model;
	
	_v3_position = v3_position;
	_v4_color = v4_color;
	//_v2_uv 	= v2_uv;
	
	gl_Position = mvp * vec4( v3_position, 1.0 ); 
}
