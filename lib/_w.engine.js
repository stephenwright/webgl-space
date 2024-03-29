/** @file _w.engine.js */
var CODEWILL = (function(){
	
	var API = {};
	
	// empty function, use for stubs
	function _fn () {} 
	API._fn = _fn;
	
	var logger = _w.getLogger(); 
	var timer  = new _w.Timer();
	
	var canvas;
	var gl;
	var shader_program;
	
	var m4_projection 	= mat4.create();
	var m4_model 		= mat4.create();
	//var m4_view 		= mat4.create();
	
	var is_initialized 	= false;
	var is_running 		= false;
	var is_paused 		= false;
	
	var modules 		= [];
	
	// =========================================================================
	
	// made some of these variables accessible to engine users 
	API.logger 	= logger;
	API.timer  	= timer;
	API.context = gl; // set again in API.init
		
	// =========================================================================
	// Model Matrix Stack
	
	var mstack = { a:[] };
	
	// Save the current model matrix
	mstack.push = function ( m ) {
		if ( m ) {
			mstack.a.push( mat4.create( m ) );
			m4_model.set( m );
		}
		else
			mstack.a.push( mat4.create( m4_model ) );
	}
	
	// Revert to previous model matrix
	mstack.pop = function () {
		if ( !mstack.a.length )
			throw( "Can't pop from an empty matrix stack." );
		return m4_model = mstack.a.pop();
	}
	
	API.mstack = mstack;
	
	// =========================================================================
	
	/**
	 */
	API.loadModule = function (mod) {
		if ( is_initialized ) mod.init(); 
		modules.push( mod ); 
	}
	
	/**
	 */
	function glErrorCheck ( msg ) {
		msg = msg || '';
		var err = gl.getError();
		if ( err ) {
			var attr, name = 'unknown';
			for ( attr in gl ) if ( gl[ attr ] == err ) name = attr;
			logger.error( _w.strf( "glError:[ {0} - {1} ] {2}", err, name, msg ) );
		}
	}
	API.glErrorCheck = glErrorCheck;
	
	// =========================================================================
	// Input
	
	function input_init () {
		$(document)
			.keydown( function (e) { API.keys[ e.which ] = 1; })
			.keyup(   function (e) { API.keys[ e.which ] = 0; });
			
		$(canvas)
			.mousedown( m_down )
			.mouseup( 	m_up )
			.mousemove( function (e) { API.mouse.pos = [ e.clientX, e.clientY, 0 ]; } )
			.bind("contextmenu", function (e) { e.preventDefault(); });
	}
	
	// -------------------------------------------------------------------------
	// Keyboard
	
	API.key_cache = [];
	API.keys = []; 
	for ( var i = 0; i < 255; ++i ) API.keys[i] = API.key_cache[i] = 0;
	API.K = {
		"a": 65, "b": 66, "c": 67, "d": 68, "e": 69, "f": 70, "g": 71, 
		"h": 72, "i": 73, "j": 74, "k": 75, "l": 76, "m": 77, "n": 78,
		"o": 79, "p": 80, "q": 81, "r": 82, "s": 83, "t": 84, "u": 85, 
		"v": 86, "w": 87, "x": 88, "y": 89, "z": 90,
		
		"backspace":	8,
		"tab":			9,
		"space":  		32,
		
		"left":			37,
		"up": 			38,
		"right":		39,
		"down":			40,
		
		"enter":		13, 
		"return":		13,
		
		"shift":		16,
		"ctrl":			17,
		"alt":			18,
		"esc":			27,
		"pageup":		33,
		"pagedown":		34,
		"end":			35,
		"home":			36,
		"insert":		45,
		"delete":		46,
		"del": 			46,
		
		"tilde": 		192,
		"backtick": 	192
	};
	
	API.keys.press  = function ( ch ) { return API.keys[ ch ] == 1 && API.key_cache[ ch ] == 0; }
	API.keys.held   = function ( ch ) { return API.keys[ ch ] == 1 && API.key_cache[ ch ] == 1; }
	API.keys.isdown = function ( ch ) { return API.keys[ ch ] == 1; }
	API.keys.isup   = function ( ch ) { return API.keys[ ch ] == 0; }
	
	// -------------------------------------------------------------------------
	// Mouse
	
	API.M = { "left": 	1 ,
			  "right": 	2 ,
			  "middle": 4 };
	
	API.mouse = {};
	API.mouse.state = 0;
	API.mouse.position = [0,0,0];
	
	function m_down (e) {
		e.preventDefault();
		var w = e.which;
		if ( w === 1 ) API.mouse.state |= API.M.left;
		if ( w === 2 ) API.mouse.state |= API.M.right;
		if ( w === 3 ) API.mouse.state |= API.M.middle;
		logger.info( _w.strf( "mouse state: {0:3} {1}", API.mouse.state.toString( 2 ), _w.vec.tostr(API.mouse.pos) ) );
	}
	
	function m_up (e) {
		e.preventDefault();
		var w = e.which;
		if ( w === 1 ) API.mouse.state ^= API.M.left;
		if ( w === 2 ) API.mouse.state ^= API.M.right;
		if ( w === 3 ) API.mouse.state ^= API.M.middle;
		logger.trace( _w.strf( "mouse state: {0:3} {1}", API.mouse.state.toString( 2 ), _w.vec.tostr(API.mouse.pos) ) );
	}
	
	API.mouse.press  = function ( b ) { return API.mouse.state & b && !API.mouse.state_cache & b; }
	API.mouse.held   = function ( b ) { return API.mouse.state & b &&  API.mouse.state_cache & b; }
	API.mouse.isdown = function ( b ) { return API.mouse.state & b; }
	API.mouse.isup   = function ( b ) { return API.mouse.state & b; }
	
	// =========================================================================
	
	// Interface class for any renderable object
	API.Renderable = function () {};
	API.Renderable.prototype.init 		= _fn;
	API.Renderable.prototype.prepare 	= _fn;
	API.Renderable.prototype.step 		= _fn;
	API.Renderable.prototype.draw 		= _fn;
	API.Renderable.prototype.cleanup 	= _fn;
	API.Renderable.prototype.destroy 	= _fn;
	
	// Interface class for engine modules
	API.Module = function () {};
	API.Module.prototype = new API.Renderable();
	
	// Interface class for tree of renderables
	API.Node = function () {
		this.children = [];
		this.pos = vec3.create();
		this.rot = quat4.create();
		this.buffs = {};
	};
	API.Node.prototype = new API.Renderable();
	
	// =========================================================================
	// Polygones
	
	API.poly = {};
	
	API.poly.draw = function ( buffers ) {
		gl.bindBuffer( gl.ARRAY_BUFFER, buffers.v );
		gl.vertexAttribPointer( shader_program.attr.v3_position, buffers.v.size, gl.FLOAT, false, 0, 0 );
		//API.glErrorCheck( "set verts" );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, buffers.c );
		gl.vertexAttribPointer( shader_program.attr.v4_color, buffers.c.size, gl.FLOAT, false, 0, 0 );
		//API.glErrorCheck( "set colors" );
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffers.i );
		gl.drawElements( gl.TRIANGLES, buffers.i.count, gl.UNSIGNED_SHORT, 0 );
		API.glErrorCheck( "poly.draw" );
	};
	
	API.poly.draw_line = function ( buffers ) {
		gl.bindBuffer( gl.ARRAY_BUFFER, buffers.v );
		gl.vertexAttribPointer( shader_program.attr.v3_position, buffers.v.size, gl.FLOAT, false, 0, 0 );
		//API.glErrorCheck( "set verts" );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, buffers.c );
		gl.vertexAttribPointer( shader_program.attr.v4_color, buffers.c.size, gl.FLOAT, false, 0, 0 );
		//API.glErrorCheck( "set colors" );
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffers.i );
		gl.drawElements( gl.LINES, buffers.i.count, gl.UNSIGNED_SHORT, 0 );
		API.glErrorCheck( "poly.draw_line" );
	};
	
	// =========================================================================
	// Lines
	
	API.line = {};
	
	API.line.generate = function () {
		var verts 	= new Float32Array( [0,0,0 , 0,1,0] );
		
		var indices = [ 0 , 1 ];
		
		var colors 	= [ .7,.7,.0,.3
					  , .7,.7,.7,.3 ];
		
		var b = {};
		
		b.v = gl.createBuffer();
		b.c = gl.createBuffer();
		b.i = gl.createBuffer();
		
		b.v.size = 3;
		b.c.size = 4;
		b.i.size = 1;
		
		b.v.count = 2;
		b.c.count = 2;
		b.i.count = 2;
		
		gl.bindBuffer( gl.ARRAY_BUFFER, b.v );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), gl.DYNAMIC_DRAW );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, b.c );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, b.i );
		gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
		
		API.glErrorCheck( "main.generate_line_buffers" );
		return b;
	};
	
	API.line.update = function ( b, p1, p2 ) {
		var verts = new Float32Array( p1.length + p2.length );
		verts.set( p1 );
		verts.set( p2, p1.length );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, b.v );
		gl.bufferSubData( gl.ARRAY_BUFFER, 0, new Float32Array( verts ) );
		API.glErrorCheck( "main.set_line_buffers" );
	};
	
	API.line.draw = API.poly.draw_line;
	
	// =========================================================================
	// Entities - things in the world
	
	var entity = {};
	entity.draw = function ( ent ) {
		mstack.push();
		
		// move into position
		mat4.translate(m4_model, ent.pos);
		
		// set orientation
		mat4.multiply( m4_model, quat4.toMat4( ent.rot ) );
		
		// push the model transform to the shader
		gl.uniformMatrix4fv( shader_program.uni.m4_model, false, m4_model );
		
		// draw the mesh
		API.poly.draw( ent.buffs );
		
		mstack.pop();
		// reset the model matrix
		gl.uniformMatrix4fv( shader_program.uni.m4_model, false, m4_model );
	};
	
	/**
	 * check if two entities have collided
	 */
	entity.collide = function ( e1, e2 ) {
		var d = vec3.dist( e1.pos, e2.pos );
		var r2 = e1.radius + e2.radius;
		return d < r2;
	}
	
	API.entity = entity;
	
	// =========================================================================
	// Shaders
	
	function loadShader ( uri, type ) {
		logger.debug('loadShader');
		var src, shader;
		$.ajax({ url: uri, async: false, success: function(data){ src = data; }});
		
			 if ( type == "x-shader/x-vertex"   ) shader = gl.createShader( gl.VERTEX_SHADER );
		else if ( type == "x-shader/x-fragment" ) shader = gl.createShader( gl.FRAGMENT_SHADER );
		else throw new Error( "invalid shader type" );

		gl.shaderSource( shader, src );
		gl.compileShader( shader );

		if ( ! gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) 
			throw new Error( gl.getShaderInfoLog( shader ) );
			
		glErrorCheck( 'shader load' );
		
		return shader;
	}
	API.loadShader = loadShader;
	
	// =========================================================================
	// Textures
	
	function hTextureLoad ( tx ) {
		gl.bindTexture( 	gl.TEXTURE_2D, tx.h );
		//gl.pixelStorei( 	gl.UNPACK_FLIP_Y_WEBGL, true) ;
		gl.texImage2D( 		gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tx.image );
		gl.texParameteri( 	gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
		gl.texParameteri( 	gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
		gl.bindTexture( 	gl.TEXTURE_2D, null );
		
		glErrorCheck( 'texture load' );
	}
	API.hTextureLoad = hTextureLoad;
	
	// =========================================================================
	// Camera
	
	API.Camera = function () {
		this.pos 	= [0,0,9];
		this.trg 	= [0,0,0];
		this.up 	= [0,1,0];
		this.view 	= mat4.create()
		this.reset();
	};
	API.Camera.prototype = new API.Node();
	API.Camera.prototype.reset = function () {
		//logger.info( 'camera.reset' );
		var x = this.pos[0];
		var y = this.pos[1];
		this.trg = [x,y,0];
		mat4.lookAt( this.pos, this.trg, this.up, this.view );
	};
	API.Camera.prototype.move = function ( v ) {
		//logger.info( _w.vec.tostr( v ) );
		vec3.add( this.pos, v );
		this.reset();
	};
	API.camera = new API.Camera();
	
	// =========================================================================
	// Initialization
	
	API.init = function () {
		logger.attach( $('#console').get(0) );
		logger.info( 'init' );
		
		try {
			canvas = document.getElementById('portal');
			
			API.context = gl =  WebGLDebugUtils.makeDebugContext( canvas.getContext('experimental-webgl') );
			if (!gl) throw "no webgl :(";
			
			gl.viewportWidth  = canvas.width;
			gl.viewportHeight = canvas.height;
			
			//gl.enable( gl.DEPTH_TEST );
			//gl.depthFunc( gl.LEQUAL );
			gl.enable( gl.BLEND );
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
			
			gl.clearColor( 0.3, 0.4, 0.6, 1.0 );
			gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
			
			glErrorCheck( 'context initialization' );
			
			input_init();
			
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

			shader_program.uni = {};
			shader_program.uni.m4_model 		= gl.getUniformLocation( shader_program, "m4_model" );
			shader_program.uni.m4_view 			= gl.getUniformLocation( shader_program, "m4_view" );
			shader_program.uni.m4_projection 	= gl.getUniformLocation( shader_program, "m4_projection" );
			glErrorCheck( 'shader uniforms' );
			
			shader_program.attr = {};
			shader_program.attr.v3_position = gl.getAttribLocation( shader_program, "v3_position" );
			shader_program.attr.v4_color 	= gl.getAttribLocation( shader_program, "v4_color" );
			glErrorCheck( 'shader attributes' );
			
			gl.enableVertexAttribArray( shader_program.attr.v3_position );
			gl.enableVertexAttribArray( shader_program.attr.v4_color );
		
			// start the loop
			window.setInterval(tick, 1000/35); // 35 fps
			
			is_initialized = true;
		
			_.each(modules, function(m){ m.init(); });
		}
		catch (e) { logger.fatal(e); }
	};
	
	// =========================================================================
	
	/**
	 * Kick things off
	 */
	function start () { 
		if ( is_running ) return;
		logger.info( "game started." );
		reset();
		is_running = true;
		is_paused = false;
		timer.start(); 
		canvas.parentNode.className = 'running';
	}
	API.start = start;
	
	/**
	 * End It
	 */
	function stop () {
		if ( !is_running ) return;
		logger.info( "game stopped." );
		is_running = false; 
		timer.stop();
		canvas.parentNode.className = 'stopped';
	}
	API.stop = stop;
	
	/**
	 * Put things to the startup positions
	 */
	function reset () {
		_.each(modules, function(m){ m.prepare(); });
		
		API.camera.prepare();
		
		gl.viewport( 0, 0, gl.viewportWidth, gl.viewportHeight );
		//mat4.perspective( 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, m4_projection );
		var w2 = gl.viewportWidth/2;
		var h2 = gl.viewportHeight/2;
		_w.mat.ortho( -w2, w2, -h2, h2, 10, -100, m4_projection );
		
		glErrorCheck( "doing a reset" );
	}
	API.reset = reset;
	
	/**
	 * Temporarily suspend things
	 */
	function pause () {
		if ( !is_running ) return;
		if ( is_paused = !is_paused ) {
			timer.stop();
			canvas.parentNode.className = 'paused';
			logger.info( "game paused." );
		}
		else {
			timer.start();
			canvas.parentNode.className = 'running';
			logger.info( "game unpaused." ); 
		} 
	}
	API.pause = pause;
	
	// =========================================================================
	
	/**
	 * 
	 */
	function tick () {
		// check for console request
		if ( API.keys.press( API.K.tilde ) ) { 
			console.info("show console");
			$( '#tabs a[name="console"]' ).click();
		}
		
		// check for stop/start key
		if ( API.keys.press( API.K.enter ) || API.keys.press( API.K.esc ) ) {
			if ( is_running )
				API.pause();
			else
				API.start();
		} 
		
		// do game loop
		if ( is_running && !is_paused ) {
			timer.tick(); 
			step();
			draw();
		}
		
		// cache key state for next iteration
		var i, l = API.keys.length;
		for (i=0; i<l;++i) API.key_cache[i] = API.keys[i];
		
		API.mouse.cache = _w.extend( {}, API.mouse );
	}
	
	API.fps 		= 0;
	var ms_count 	= 0;
	var frame_count = 0;
	
	/**
	 */
	function step () {
		if ( ( ms_count += timer.etime ) < 1 ) { ++frame_count; }
		else { API.fps = frame_count; ms_count = frame_count = 0; }
		
		_.each(modules, function(m){ m.step(); });
	}
	
	/**
	 */
	function draw () {
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		mat4.identity( m4_model );
		
		// set the camera transforms
		gl.uniformMatrix4fv( shader_program.uni.m4_projection, 	false, m4_projection );
		gl.uniformMatrix4fv( shader_program.uni.m4_view, 		false, API.camera.view );
		// set the model transform
		gl.uniformMatrix4fv( shader_program.uni.m4_model, 		false, m4_model );
		
		_.each(modules, function (m) { m.draw(); });
	}
	
	// =========================================================================
	// Tests
	
	function charTest () {
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
