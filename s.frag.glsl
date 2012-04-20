/** @file s.frag.glsl */

//#ifdef GL_ES
//precision highp float;
//#endif
//
varying lowp vec4 vColor;
//varying vec2 vTextureCoord;
//uniform sampler2D uSampler;

void main(void) { 
	//gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );
	gl_FragColor = vColor;
	//gl_FragColor = texture2D( uSampler, vec2( vTextureCoord.s, vTextureCoord.t ) );
}
