/** @file main.js */
var CODEWILL = (function(){

	var API = {};
	
	var logger 			= _w.getLogger();
	var timer 			= new _w.Timer();
	
	var gl;
	var shader_program;
	
	var m4_projection 	= mat4.create();
	var m4_model 		= mat4.create();
	var m4_view 		= mat4.create();
	
	var mainship;
	
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
	
	// =========================================================================
	// Input
	API.keys = []; for (var i=0; i<255;++i) API.keys[i] = 0;
	API.K = {
		a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, 
		h: 72, i: 73, j: 74, k: 75, l: 76, m: 77, n: 78,
		o: 79, p: 80, q: 81, r: 82, s: 83, t: 84, u: 85, 
		v: 86, w: 87, x: 88, y: 89, z: 90,
		
		backspace:	8,
		tab:		9,
		space:  	32,
		
		left:		37,
		up: 		38,
		right:		39,
		down:		40,
		
		enter:		13, 
		return:		13,
		
		shift:		16,
		ctrl:		17,
		alt:		18,
		esc:		27,
		home:		36,
		end:		35,
		pageup:		33,
		pagedown:	34,
		insert:		45,
		delete:		46
	};
	
	$(document)
		.keydown(function(e){ var k = e.which; if (API.keys[k]!=1){API.keys[k] = 1; logger.trace('down:'+k)}})
		.keyup(	 function(e){ var k = e.which; if (API.keys[k]==1){API.keys[k] = 0; }}); 
	
	// =========================================================================
	
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
			
			gl.enable( gl.DEPTH_TEST );
			gl.depthFunc( gl.LEQUAL );
			
			gl.clearColor( 0.3, 0.4, 0.6, 1.0 );
			gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
			
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
			mainship = shipyard.build();
			
			//charTest();
			
			var eye 	= vec3.create([0,0,-10]);
			var center 	= vec3.create([0,0,0]);
			var up 		= vec3.create([0,1,0]);
			mat4.lookAt(eye, center, up, m4_view);
			
			gl.viewport( 0, 0, gl.viewportWidth, gl.viewportHeight );
			//mat4.perspective( 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, m4_projection );
			var w2 = gl.viewportWidth/2;
			var h2 = gl.viewportHeight/2;
			mat4.ortho(-w2, w2, -h2, h2, -10, 100, m4_projection);
			
			// start the loop
			window.setInterval(tick, 1000/30); // 30 fps
		}
		catch (e) { logger.fatal(e); }
	};
	
	// =========================================================================
	
	/**
	 * 
	 */
	function tick () {
		try {
			timer.tick(); 
			step();
			draw();
		}
		catch( e ){ logger.error( e ); throw e; }
	}
	
	/**
	 * 
	 */
	function step() {
		shipyard.step( mainship );
	}
	
	/**
	 * 
	 */
	function draw() {
		// print some scene info
		var info = '';
		info += _w.strf('<p>viewport: [{0},{1}]</p>', gl.viewportWidth, gl.viewportHeight );
		info += '<h6>mainship</h6>'
		info += _w.strf('ship.pos:   	{0}<br/>', vec3.str(mainship.pos) );
		info += _w.strf('ship.speed: 	{0}<br/>', mainship.speed );
		info += _w.strf('ship.thrust: 	{0}<br/>', mainship.thrust );
		info += _w.strf('ship.has_tail: {0}<br/>', mainship.has_tail );
		
		$('#info').html( info );
		
		//logger.debug('draw');
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		mat4.identity( m4_model );
		
		// set the camera transforms
		gl.uniformMatrix4fv( shader_program.uni.m4_projection, 	false, m4_projection );
		gl.uniformMatrix4fv( shader_program.uni.m4_view, 		false, m4_view );
		// set the model transform
		gl.uniformMatrix4fv( shader_program.uni.m4_model, 		false, m4_model );
		
		// draw element
		shipyard.draw( mainship );
	}
	
	// =========================================================================
	
	var GROUND_MAX_SPEED =  8;
	var GROUND_MIN_SPEED = -2;
	var GROUND_ACCELERATION_RATE = .3;
	var GROUND_DECELERATION_RATE = ACCELERATION_RATE/2;
	function move_ground (ship, a) {
			 if ( a > 0 ) { ship.speed += GROUND_ACCELERATION_RATE; }
		else if ( a < 0 ) { ship.speed -= GROUND_ACCELERATION_RATE; }
		else { // decelerate
			if (ship.speed > 0) ship.speed -= GROUND_DECELERATION_RATE;
			if (ship.speed < 0) ship.speed += GROUND_DECELERATION_RATE;
		}
		// keep speed within bounds
		if (ship.speed > GROUND_MAX_SPEED) ship.speed = GROUND_MAX_SPEED;
		if (ship.speed < GROUND_MIN_SPEED) ship.speed = GROUND_MIN_SPEED;
		
		// move the ship
		if (ship.speed != 0) {
			var d = [0,1,0];
			quat4.multiplyVec3( ship.rot, d );
			vec3.normalize( d );
			vec3.scale( d, ship.speed );
			vec3.add( ship.pos, d );
		}
	}
	
	var MAX_THRUST = 5;
	var MAX_SPEED = 8;
	var MIN_SPEED = 0;
	var ACCELERATION_RATE = .3;
	var DECELERATION_RATE = .98;
	function move_space (ship, a) {
		// calculate thrust
		if ( a > 0 ) ship.thrust += ACCELERATION_RATE; else ship.thrust = 0;
		if ( ship.thrust > MAX_THRUST ) ship.thrust = MAX_THRUST;
		
		// decelerate
		if (ship.speed != 0)
			ship.speed = Math.floor(ship.speed * DECELERATION_RATE * 10) / 10;
		
		ship.speed += ship.thrust;
		
		if (ship.speed > MAX_SPEED) ship.speed = MAX_SPEED;
		if (ship.speed < MIN_SPEED) ship.speed = MIN_SPEED;
		
		// current velocity
		var v = vec3.scale( vec3.create( ship.dir ), ship.speed );
		
		// change in velocity
		if (a) {
			// applied force, accelaration in the direction the ship is facing
			var f = [0,1,0];
			quat4.multiplyVec3( ship.rot, f );
			vec3.normalize( f ); 			// unit vector representing ships direction
			vec3.scale( f, ship.thrust ); 	// scalled by the current thrust
			vec3.add( v, f ); 				// added to the current velocity
			// new velocity
			ship.speed = vec3.length( v );
			ship.dir = vec3.normalize( v, [] );
		}
		vec3.add( ship.pos, v );
	}
	
	var shipyard = {};
	shipyard.step = function (ship) {
		var x = API.keys[ API.K.a ] - API.keys[ API.K.d ];
		var y = API.keys[ API.K.w ] - API.keys[ API.K.s ];
		
		// turn
		var ROTATE_SPEED = 15;
		var angle;
		if (angle = _w.deg2rad( x * ROTATE_SPEED )) {
			var q = _w.quat.fromAxis([0,0,1], -angle);
			quat4.multiply(mainship.rot, q);
		}
		
		// move
		move_space( ship, y );
		
		// keep ship on the field 
		var w = gl.viewportWidth/2;
		var h = gl.viewportHeight/2;
		var p = ship.pos;
		if (p[0] > w) p[0] = -w; else if (p[0] < -w) p[0] = w;
		if (p[1] > h) p[1] = -h; else if (p[1] < -h) p[1] = h;
		ship.pos = p;
	};
	shipyard.draw = function (ship) {
		mstack.push();
		//mat4.fromRotationTranslation(ship.rot, ship.pos, m4_model);
		mat4.translate(m4_model, ship.pos);
		
		ship.buffs.v.size 	= ship.thrust ? 6 : 3;
		ship.buffs.i.count 	= ship.thrust ? 6 : 3;
		
		var m = mat4.create();
		quat4.toMat4(ship.rot, m);
		mat4.multiply(m4_model, m);
		//mat4.rotate(m4_model, ship.rot[3], vec3.create(ship.rot));
		
		// set the model transform
		gl.uniformMatrix4fv( shader_program.uni.m4_model, false, m4_model );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, ship.buffs.v );
		gl.vertexAttribPointer( shader_program.attr.v3_position, ship.buffs.v.size, gl.FLOAT, false, 0, 0 );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, ship.buffs.c );
		gl.vertexAttribPointer( shader_program.attr.v4_color, ship.buffs.c.size, gl.FLOAT, false, 0, 0 );
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, ship.buffs.i );
		gl.drawElements( gl.TRIANGLES, ship.buffs.i.count, gl.UNSIGNED_SHORT, 0 );
		mstack.pop();
	};
	shipyard.build = function (){
		var ship = {};
		ship.pos = vec3.create([0,30,0]);
		ship.dir = vec3.create([0,1,0]);	// movement heading
		ship.rot = quat4.create([0,0,1,0]); // orientation
		ship.has_tail = false;
		
		ship.speed 	= 0; // movement velocity
		ship.thrust = 0;
		
		var buffs = {};
		var verts = [-5, -5, 0,
					  5, -5, 0,
					  0, 10, 0];
		buffs.v = gl.createBuffer();
		buffs.v.size = 3;
		buffs.v.count = 3;

		var colors = [];
		for ( var i = 0; i < 3; ++i )
			colors = colors.concat( [ 0.0, 1.0, 0.0, 1.0 ] ); // green
		buffs.c = gl.createBuffer();
		buffs.c.size = 4;
		buffs.c.count = 3;
		
		// index buffer
		var indices = [ 0,1,2 , 3,4,5 ];
		buffs.i = gl.createBuffer();
		buffs.i.size = 1;
		buffs.i.count = 3;
		
		// tail
		verts = verts.concat([-3, -5, 0,
							   3, -5, 0,
							   0,-12, 0]);
		for ( var i = 0; i < 3; ++i )
			colors = colors.concat( [ 1.0, 0.0, 0.0, 1.0 ] ); // red 
		
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.v ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), gl.STATIC_DRAW );
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.c ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffs.i ); 	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
		
		ship.buffs = buffs;
		return ship;
	};
	
	// =========================================================================
	// Tests
	
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


$(function(){
	_w.ui.tabs( 'tabs' );
	
});