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
	var m4_view 		= mat4.create();
	
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
		"del": 			46
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
	// Entities - things in the world
	
	var entity = {};
	entity.draw = function ( ent ) {
		mstack.push();
		
		// move into position
		mat4.translate(m4_model, ent.pos);
		
		// set orientation
		var m = mat4.create();
		quat4.toMat4(ent.rot, m);
		mat4.multiply(m4_model, m);
		
		// push the model transform to the shader
		gl.uniformMatrix4fv( shader_program.uni.m4_model, false, m4_model );
		
		// draw the mesh
		gl.bindBuffer( gl.ARRAY_BUFFER, ent.buffs.v );
		gl.vertexAttribPointer( shader_program.attr.v3_position, ent.buffs.v.size, gl.FLOAT, false, 0, 0 );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, ent.buffs.c );
		gl.vertexAttribPointer( shader_program.attr.v4_color, ent.buffs.c.size, gl.FLOAT, false, 0, 0 );
		
		API.glErrorCheck( "set verts" );
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, ent.buffs.i );
		gl.drawElements( gl.TRIANGLES, ent.buffs.i.count, gl.UNSIGNED_SHORT, 0 );
		
		API.glErrorCheck( "entity.draw" );
		
		mstack.pop();
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
			
			shader_program.attr = {};
			shader_program.attr.v3_position = gl.getAttribLocation( shader_program, "v3_position" );
			shader_program.attr.v4_color 	= gl.getAttribLocation( shader_program, "v4_color" );
			
			gl.enableVertexAttribArray( shader_program.attr.v3_position );
			gl.enableVertexAttribArray( shader_program.attr.v4_color );

			shader_program.uni = {};
			shader_program.uni.m4_model 		= gl.getUniformLocation( shader_program, "m4_model" );
			shader_program.uni.m4_view 			= gl.getUniformLocation( shader_program, "m4_view" );
			shader_program.uni.m4_projection 	= gl.getUniformLocation( shader_program, "m4_projection" );
			
			glErrorCheck( 'shader initialization' );
		
			// start the loop
			window.setInterval(tick, 1000/30); // 30 fps
			
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
		
		// reset the camera
		var eye 	= vec3.create([0,0,9]);
		var center 	= vec3.create([0,0,0]);
		var up 		= vec3.create([0,1,0]);
		mat4.lookAt(eye, center, up, m4_view);
		
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
		gl.uniformMatrix4fv( shader_program.uni.m4_view, 		false, m4_view );
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
