/** @file main.js */
var CODEWILL = (function(){

	var API = {};
	
	var logger = _w.getLogger();
	var timer = new _w.Timer();
	var gl;
	var shader_program;
	
	var m4_projection 	= mat4.create();
	var m4_model 		= mat4.create();
	var m4_view 		= mat4.create();
	
	var obj = {};
	
	// =========================================================================
	// Initialization
	
	API.init = function () {
		logger.attach( $('#console').get(0) );
		logger.info( 'init' );
		
		try {
			var canvas = document.getElementById('portal');
			
			gl = canvas.getContext('experimental-webgl');
			if (!gl) throw "no webgl :(";
			
			gl.viewportWidth  = canvas.width;
			gl.viewportHeight = canvas.height;
			
			gl.clearColor( 0.3, 0.4, 0.6, 1.0 );
			gl.enable( gl.DEPTH_TEST );
			gl.depthFunc( gl.LEQUAL );
			gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
			
			gl.viewport( 0, 0, gl.viewportWidth, gl.viewportHeight );
			mat4.perspective( 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, m4_projection );
			
			// Init Shaders
			// -----------------------------------------------------------------
			var vert_shader = loadShader( "s.vert.glsl", "x-shader/x-vertex" );
			var frag_shader = loadShader( "s.frag.glsl", "x-shader/x-fragment" );
				
			shader_program = gl.createProgram();
			gl.attachShader( shader_program, vert_shader );
			gl.attachShader( shader_program, frag_shader );
			gl.linkProgram( shader_program );
			
			if ( !gl.getProgramParameter( shader_program, gl.LINK_STATUS ) )
				throw( "Could not initialize shaders" );
			
			gl.useProgram( shader_program );
			
			shader_program.attr = {};
			shader_program.attr.v3_position = gl.getAttribLocation( shader_program, "v3_position" );
			shader_program.attr.v4_color 	= gl.getAttribLocation( shader_program, "v4_color" );
			shader_program.attr.v2_uv 		= gl.getAttribLocation( shader_program, "v2_uv" );
			gl.enableVertexAttribArray( shader_program.attr.v3_position );
			gl.enableVertexAttribArray( shader_program.attr.v4_color );
			gl.enableVertexAttribArray( shader_program.attr.v2_uv );

			shader_program.uni = {};
			shader_program.uni.m4_model 		= gl.getUniformLocation( shader_program, "m4_model" );
			shader_program.uni.m4_view 			= gl.getUniformLocation( shader_program, "m4_view" );
			shader_program.uni.m4_projection 	= gl.getUniformLocation( shader_program, "m4_projection" );
			
			// init object
			var verts = [ -1.0, -1.0, 0.0,
						   1.0, -1.0, 0.0,
						   0.0,  1.0, 0.0 ];
			obj.v_buff = gl.createBuffer();
			obj.v_buff.itemSize = 3;
			obj.v_buff.numItems = 3;
			gl.bindBuffer( gl.ARRAY_BUFFER, obj.v_buff );
			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), gl.STATIC_DRAW );

			var colors = [];
			for ( var i = 0; i < 3; ++i )
				colors = colors.concat( [ 0.0, 1.0, 0.0, 1.0 ] ); // green 
			obj.c_buff = gl.createBuffer();	
			obj.c_buff.itemSize = 4;
			obj.c_buff.numItems = 3;
			gl.bindBuffer( gl.ARRAY_BUFFER, obj.c_buff );
			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
			
			// index buffer
			var indices = [ 0,1,2 ];
			obj.i_buff = gl.createBuffer();
			obj.i_buff.itemSize = 1;
			obj.i_buff.numItems = 3;
			gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, obj.i_buff );
			gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
			
			draw();
			
			//charTest();
		}
		catch (e) { logger.fatal(e); }
	};
	
	// =========================================================================
	
	/**
	 *
	 */
	function loadShader ( uri, type ) {
		logger.debug('loadShader');
		var src, shader;
		$.ajax({ url: uri, async: false, success: function(data){ src = data; }});
		//logger.debug( src );
		
			 if ( type == "x-shader/x-vertex"   ) shader = gl.createShader( gl.VERTEX_SHADER );
		else if ( type == "x-shader/x-fragment" ) shader = gl.createShader( gl.FRAGMENT_SHADER );
		else throw new Error( "invalid shader type" );

		gl.shaderSource( shader, src );
		gl.compileShader( shader );

		if ( ! gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) 
			throw new Error( gl.getShaderInfoLog( shader ) );
		
		return shader;
	}
	
	/**
	 * 
	 */
	function draw () {
		logger.debug('draw');
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		mat4.identity( m4_model );
		
		gl.uniformMatrix4fv( shader_program.uni.m4_model, 		false, m4_model );
		gl.uniformMatrix4fv( shader_program.uni.m4_view, 		false, m4_view );
		gl.uniformMatrix4fv( shader_program.uni.m4_projection, 	false, m4_projection );
		
		//mat4.translate( mvMatrix, this.pos );
		//mat4.rotate( mvMatrix, util.math.deg_to_rad( this.rot.angle ), this.rot.axis );
		
		//gl.activeTexture( gl.TEXTURE1 );
		//gl.bindTexture( gl.TEXTURE_2D, t_dirt );
		//gl.uniform1i( gl.getUniformLocation( shaderProgram, "uSampler" ), 1 );
		
		//gl.bindBuffer( gl.ARRAY_BUFFER, this.t_buff );
		//gl.vertexAttribPointer( shaderProgram.textureCoordAttribute, this.t_buff.itemSize, gl.FLOAT, false, 0, 0 );

		gl.bindBuffer( gl.ARRAY_BUFFER, obj.v_buff );
		gl.vertexAttribPointer( shader_program.attr.v3_position, obj.v_buff.itemSize, gl.FLOAT, false, 0, 0 );

		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, obj.i_buff );
		
		gl.drawElements( gl.TRIANGLES, obj.i_buff.numItems, gl.UNSIGNED_SHORT, 0 );
	}
	
	/**
	 * 
	 */
	function charTest(){
		var s = " !\"#$%&'()*+,-./0@ABCDEFGHIJKLMNOPQRSTUVWXYZ`abcdefghijklmnopqrstuvwxyz";
		for ( var i = 0; i < s.length; ++i ) {
			var ch = s[i];
			var p = ch.charCodeAt() - 32;
			var r = Math.floor( p / 16 );
			var c = p % 16;
			logger.debug( _w.strf( "{0} = {1:2} + ({2:2},{3:2})", ch, p, c, r ) );
		}
	}
	
	// =========================================================================
	// And we're done! return the public functions
	return API;
})();

$(CODEWILL.init);