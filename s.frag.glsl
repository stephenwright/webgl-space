/** @file s.frag.glsl */

precision mediump float;

//uniform sampler2D uSampler;
uniform mat4 m4_view;

const vec3 light_a = vec3( 1.0 );
const vec3 light_d = vec3( 0.8 );
const vec3 light_s = vec3( 0.4 );
const vec4 light_p = vec4( 100., 100., 10., 1. );

const vec3 n = vec3( 0., 0., 1. );

const vec3 k_a = vec3( 0.8 );
const vec3 k_d = vec3( 0.5 );
const vec3 k_s = vec3( 0.2 );

varying vec3 _v3_position;
varying vec4 _v4_color;
//varying vec4 _v3_normal;
//varying vec2 _v2_uv;

// phong model
vec3 ads() {
	vec4 lp = m4_view * light_p;
	//vec3 n = normalize( _v3_normal );
	vec3 v = normalize( -_v3_position );
	vec3 s = normalize( lp.xyz - _v3_position );
	vec3 r = normalize( reflect( -s, n ) );
	vec3 h = normalize( v + s );
	
	float sn = max( dot( s, n ), 0. );
	
	return light_a * 
		( k_a +  k_d * sn 
		+  k_s * pow( max( dot( h, n ), 0. ),0. ) );
}

// flat even lighting model
lowp vec3 matte() {
	vec4 lp = m4_view * light_p;
	//vec3 n = normalize( _v3_normal );
	vec3 s = normalize( lp.xyz - _v3_position );
	float sn = max( dot( s, n ), 0. );
	vec3 ambient = light_a * k_a;
	vec3 diffuse = light_d * k_d;
	return ambient + diffuse * sn;
}

void main(void) {
	vec3 I = ads();
	gl_FragColor = vec4( _v4_color.rgb * I, _v4_color.a );
}
