/** @file s.frag.glsl */

varying lowp vec4 _v4_color;
//varying 	 vec2 _v2_uv;

//uniform sampler2D uSampler;

void main(void) { 
	//gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );
	gl_FragColor = _v4_color;
	//gl_FragColor = texture2D( uSampler, _v2_uv );
}
