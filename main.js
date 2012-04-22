/** @file main.js */
var CODEWILL = (function(){

	function _fn () {}

	var API = {};
	
	var logger 			= _w.getLogger();
	var timer 			= new _w.Timer();
	var canvas 			= null;
	
	var gl;
	var shader_program;
	
	var m4_projection 	= mat4.create();
	var m4_model 		= mat4.create();
	var m4_view 		= mat4.create();
	
	// =========================================================================
	// Game State
	
	var mainship;
	var score 			= 0;
	
	var is_running 		= false;
	var is_paused 		= false;
	
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
		shipyard.prepare();
		ammodepot.prepare();
		astroidbelt.prepare();
		
		score = 0;
		
		// reset the camera
		var eye 	= vec3.create([0,0,-10]);
		var center 	= vec3.create([0,0,0]);
		var up 		= vec3.create([0,1,0]);
		mat4.lookAt(eye, center, up, m4_view);
		
		gl.viewport( 0, 0, gl.viewportWidth, gl.viewportHeight );
		//mat4.perspective( 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, m4_projection );
		var w2 = gl.viewportWidth/2;
		var h2 = gl.viewportHeight/2;
		_w.mat.ortho( -w2, w2, -h2, h2, 10, -100, m4_projection );
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
	API.key_cache = [];
	API.keys = []; 
	for ( var i = 0; i < 255; ++i ) API.keys[i] = API.key_cache[i] = 0;
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
		.keydown( function (e) { API.keys[ e.which ] = 1; })
		.keyup(   function (e) { API.keys[ e.which ] = 0; });
	
	// -------------------------------------------------------------------------
	// Helpers
	
	API.keys.press  = function ( ch ) { return API.keys[ ch ] == 1 && API.key_cache[ ch ] == 0; }
	API.keys.held   = function ( ch ) { return API.keys[ ch ] == 1 && API.key_cache[ ch ] == 1; }
	API.keys.isdown = function ( ch ) { return API.keys[ ch ] == 1; }
	API.keys.isup   = function ( ch ) { return API.keys[ ch ] == 0; }
	
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
			canvas = document.getElementById('portal');
			
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
			shipyard.init();
			ammodepot.init();
			astroidbelt.init();
			gravitywell.init();
			
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
		//try{
		if ( API.keys.press( API.K.enter ) || API.keys.press( API.K.esc ) ) {
			if ( is_running )
				API.pause();
			else
				API.start();
		} 
		
		if ( is_running && !is_paused ) {
			timer.tick(); 
			step();
			draw();
		} 
		//}catch( e ){ logger.error( e ); throw e; }
		var i, l = API.keys.length;
		for (i=0; i<l;++i) API.key_cache[i] = API.keys[i];
	}
	
	var ms_count = 0;
	var frame_count = 0;
	var fps = 0;
	
	/**
	 * 
	 */
	function step() {
		if ( ( ms_count += timer.etime ) < 1 ) { ++frame_count; } 
		else { fps = frame_count; ms_count = frame_count = 0; }
		
		gravitywell.step();
		astroidbelt.step();
		shipyard.step();
		ammodepot.step();
		
		var e = gl.getError();
		if ( e ) logger.error( _w.strf( "GL Error: {0}", e ) );
	}
	
	/**
	 * 
	 */
	function draw() {
		// print some scene info
		var info = '';
		info += _w.strf('viewport: [ {0}, {1} ]<br/>', gl.viewportWidth, gl.viewportHeight );
		var ms = timer.time;
		info += _w.strf('time: {0}m{1}s<br/>', (ms/60000).toFixed(0), ((ms%60000)/1000).toFixed(2) );
		info += _w.strf('etime: {0}<br/>', timer.etime );
		info += _w.strf('fps: {0}<br/>', fps );
		
		info += '<h6>mainship</h6>'
		info += _w.strf('ship.pos:   	{0}<br/>', _w.vec.tostr( mainship.pos ) );
		info += _w.strf('ship.velocity: {0}<br/>', _w.vec.tostr( mainship.velocity, 2 ) );
		info += _w.strf('ship.dir:   	{0}<br/>', _w.vec.tostr( mainship.dir, 1 ) );
		info += _w.strf('ship.speed: 	{0}<br/>', vec3.length(  mainship.velocity ) );
		info += _w.strf('ship.thrust: 	{0}<br/>', mainship.thrust );
		
		$( '#info' ).html( info );
		
		$( '#scoreboard' ).html( _w.strf( 'sheild {0} :: score {1}', mainship.sheild, score ) );
		
		//logger.debug('draw');
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		mat4.identity( m4_model );
		
		// set the camera transforms
		gl.uniformMatrix4fv( shader_program.uni.m4_projection, 	false, m4_projection );
		gl.uniformMatrix4fv( shader_program.uni.m4_view, 		false, m4_view );
		// set the model transform
		gl.uniformMatrix4fv( shader_program.uni.m4_model, 		false, m4_model );
		
		// draw element
		gravitywell.draw();
		astroidbelt.draw();
		shipyard.draw();
		ammodepot.draw();
	}
	
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
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, ent.buffs.i );
		gl.drawElements( gl.TRIANGLES, ent.buffs.i.count, gl.UNSIGNED_SHORT, 0 );
		
		mstack.pop();
	};
	API.entity = entity;
	
	/**
	 * wrap entities around the edge of the screen
	 */
	function wrap_edge ( ent ) {
		var w = gl.viewportWidth/2;
		var h = gl.viewportHeight/2;
		var p = ent.pos;
		if (p[0] > w) p[0] = -w; else if (p[0] < -w) p[0] = w;
		if (p[1] > h) p[1] = -h; else if (p[1] < -h) p[1] = h;
	}
	
	/**
	 * check if two entities have collided
	 */
	function collide ( e1, e2 ) {
		var d = vec3.dist( e1.pos, e2.pos );
		var r2 = e1.radius + e2.radius;
		return d < r2;
	}
	
	/**
	 * @param ent - an entity (object with .dir and .speed)
	 * @param f - forace being applied (vec3)
	 */
	function apply_force ( ent, f ) {
		var v = vec3.scale( ent.dir, ent.speed, [] );
		vec3.add( v, f );
		ent.dir = vec3.normalize( v, [] );
	//	vec3.add( ent.pos, v );
	}
	
	/**
	 * pull the target (trg) towards the source (src)
	 */
	function pull ( src, trg ) {
		var d = vec3.subtract( src.pos, trg.pos, [] );
		vec3.normalize( d );
		vec3.scale( d, 2 * timer.etime );
		
		//vec3.add( trg.dir, d );
		apply_force( trg, d );
	}
	
	// =========================================================================
	// Ships 
	
	// Movement Constants
	var ROTATE_SPEED = 360;
	var MAX_SPEED = 200;
	var MIN_SPEED = 0;
	var MAX_THRUST = 200;
	var ACCELERATION_RATE = MAX_THRUST/2;
	var DECELERATION_RATE = ACCELERATION_RATE;
	
	// space based movement, drifting
	function move_space ( ship, amount ) {
	
		var speed = vec3.length( ship.velocity );
		var dir = vec3.normalize( ship.velocity, [] );
		
		// decelerate if moving
		if ( speed > 0 ) {
			var rd = vec3.scale( dir, -DECELERATION_RATE * timer.etime, [] );
			vec3.add( ship.velocity, rd );
		}
		
		// calculate thrust
		ship.thrust = amount > 0 ? Math.max( ship.thrust + ACCELERATION_RATE, MAX_THRUST ) : 0;
		
		// change in velocity
		if ( ship.thrust > 0 ) {
			// applied force, accelaration in the direction the ship is facing
			var f = quat4.multiplyVec3( ship.rot, [0,1,0] ); 	// unit vector representing ships direction
			vec3.scale( f, ship.thrust * timer.etime ); 		// scalled by the current thrust
			vec3.add( ship.velocity, f ); 						// added to the current velocity
			
			// updated speed and direction based on new velocity
			// and make sure speed is within acceptable range
			speed = vec3.length( ship.velocity );
			vec3.normalize( ship.velocity, dir );
			
			if ( speed > MAX_SPEED ) {
				speed = MAX_SPEED;
				vec3.normalize( ship.velocity );
				vec3.scale( ship.velocity, speed );
			}
		}
		
		vec3.scale( dir, speed * timer.etime );
		vec3.add( ship.pos, dir );
		
		vec3.normalize( ship.velocity, ship.dir );
	}
	
	// -------------------------------------------------------------------------
	
	function Ship () {
		this.pos = vec3.create( [0,30,0] );
		this.rot = _w.quat.fromAxis( [0,0,1], 0 ); // orientation
		
		this.dir	= [0,1,0]; 
		
		this.velocity = vec3.create();
		
		this.firing = false;
		this.radius = 10;
		this.thrust = 0;
		this.sheild = 100;
		
		this.destroyed 	= _fn;
	}
	Ship.prototype.hit = function ( ent ) {
		this.sheild -= ent.damage;
	}
	Ship.prototype.step = function () {
		
	}
	
	// -------------------------------------------------------------------------
	var shipyard = { cache:[] };
	
	shipyard.init = function () {
		shipyard.prepare();
	};
	
	shipyard.prepare = function () {
		shipyard.cache = [];
		mainship = shipyard.build();
		mainship.pos = [200,-60,0];
	};
	
	shipyard.build = function () {
		var ship = shipyard.get();
		shipyard.cache.push(ship);
		return ship;
	};
	
	shipyard.get = function () {
		var ship = new Ship();
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
		buffs.i.count = 3; // set to 6 to show the tail
		
		// add a tail
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
	
	shipyard.step = function () {
		var x = 0, y = 0;
		if ( API.keys.isdown( API.K.d ) || API.keys.isdown( API.K.right ) ) x += 1;
		if ( API.keys.isdown( API.K.a ) || API.keys.isdown( API.K.left  ) ) x -= 1;
		if ( API.keys.isdown( API.K.w ) || API.keys.isdown( API.K.up    ) ) y += 1;
		if ( API.keys.isdown( API.K.s ) || API.keys.isdown( API.K.down  ) ) y -= 1;
		
		// turn
		var angle;
		if (angle = _w.deg2rad( x * ROTATE_SPEED * timer.etime )) {
			var q = _w.quat.fromAxis([0,0,1], angle);
			quat4.multiply( mainship.rot , q );
		}
		
		var i,l;
		for ( i = 0, l = shipyard.cache.length; i < l; ++i ) {
			var ship = shipyard.cache[i];
			move_space( ship, y );
			
			// keep ship on the field 
			wrap_edge( ship );
			
			// check for collision
			var collidable = [].concat(astroidbelt.cache, ammodepot.cache);
			for ( j=0; j<collidable.length; ++j ) {
				var c = collidable[j];
				if ( c.active && collide( ship, c ) ) {
					ship.hit( c )
					c.active = false;
				}
			}
		}
		
		// handle firing
		if ( !mainship.firing && API.keys.press( API.K.shift ) ) {
			var p = vec3.create( mainship.pos );
			var d = quat4.multiplyVec3( mainship.rot, [0,1,0] )
			var offset = vec3.scale( d, mainship.radius + AMMO_RADIUS + 1 );
			vec3.add( p, offset );
		
			ammodepot.fire( p, mainship.rot );
			mainship.firing = true;
		}
		else
			mainship.firing = API.keys[ API.K.shift ];
		
		// end game
		if (mainship.sheild < 0) {
			mainship.sheild = 0;
			API.stop();
		}
	};
	
	shipyard.draw = function (ship) {
		for ( i = 0, l = shipyard.cache.length; i < l; ++i ) {
			var ship = shipyard.cache[i];
			
			// show the tail if accelerating
			ship.buffs.i.count = ship.thrust ? 6 : 3;
			
			entity.draw( ship );
		}
	};
	
	shipyard.cleanup = _fn;
	shipyard.destroy = _fn;
	
	// =========================================================================
	// Ammo
	
	var AMMO_SPEED 		= 20;
	var AMMO_LIFESPAN 	= 2;
	var AMMO_RADIUS 	= 3;
	
	// -------------------------------------------------------------------------
	
	function Rocket () {
		this.pos 		= vec3.create();
		this.rot 		= quat4.create();
		this.dir 		= quat4.create();
		this.speed 		= AMMO_SPEED;
		this.lifespan 	= AMMO_LIFESPAN;
		this.radius 	= AMMO_RADIUS;
		this.active 	= true;
		this.damage 	= 10;
	}
	
	Rocket.prototype.hit = function ( ent ) {
	};
	
	// -------------------------------------------------------------------------
	
	var ammodepot = { cache:[], cache_size: 100 };
	
	ammodepot.init = function () {
		ammodepot.prepare();
	};
	ammodepot.prepare = function () {
		ammodepot.cache = [];
	};
	
	ammodepot.fire = function (pos, rot) {
		logger.trace('fire!');
		
		var a = ammodepot.get();
		
		if ( a == null ) 
			return;
		
		a.pos 		= vec3.create( pos );
		a.rot 		= quat4.create( rot );
		a.dir 		= quat4.multiplyVec3( rot, [0,1,0] );
		a.active 	= true;
		a.lifespan 	= AMMO_LIFESPAN;
	};
	
	ammodepot.get = function () {
		var a = null, i;
		for ( i = 0; i < ammodepot.cache.length; ++i ) {
			a = ammodepot.cache[i];
			if ( a != null && !a.active ) return a;
		}
		
		if ( ammodepot.cache.length == ammodepot.cache_size ) {
			logger.debug( 'max cache size reached');
			return null;
		}
			
		// got here, nothing in the cache, build a new shell
		a = new Rocket();
		
		var buffs = {};
		var verts = [-2, -3, 0,
					  2, -3, 0,
					  0,  3, 0];
		buffs.v = gl.createBuffer();
		buffs.v.size = 3;
		buffs.v.count = 3;

		var colors = [];
		for ( var i = 0; i < 3; ++i )
			colors = colors.concat( [ 1.0, 1.0, 1.0, 1.0 ] ); // white
		buffs.c = gl.createBuffer();
		buffs.c.size = 4;
		buffs.c.count = 3;
		
		var indices = [ 0,1,2 ];
		buffs.i = gl.createBuffer();
		buffs.i.size = 1;
		buffs.i.count = 3;
		
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.v ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), gl.STATIC_DRAW );
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.c ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffs.i ); 	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
		
		a.buffs = buffs;
		
		ammodepot.cache.push( a );
		return a;
	};
	
	ammodepot.remove = function (ent) {
		var c = ammodepot.cache, l = c.length, i = 0;
		for ( i=0; i<l; ++i ) if ( c[i] == ent ) { c.splice( i, 1 ); --l; }
	};
	
	ammodepot.step = function () {
		var a, i, j;
		var belt = astroidbelt.cache;
		ammoloop: for ( i = 0; i < ammodepot.cache.length; ++i ) {
			a = ammodepot.cache[i];
			if ( !a.active ) 
				continue;
			
			// check for collision
			for ( j=0; j<belt.length; ++j ) {
				if ( collide( a, belt[j] ) ) {
					var w = Math.max( Math.floor( belt[j].worth ), 1 );
					logger.info( _w.strf( 'astroid hit for {0} points!', w ) );
					score += w;
					astroidbelt.remove( belt[ j-- ] );
					a.active = false;
					score += 10;
					continue ammoloop;
				}
			}
			
			// check for end of life
			if ( (a.lifespan -= timer.etime) <= 0 ) {
				a.active = false;
				continue;
			}
			
			// move
			var d = vec3.scale( vec3.create( a.dir ), a.speed );
			vec3.add( a.pos, d );
			wrap_edge( a );
		}
	};
	
	ammodepot.draw = function () {
		var a, i;
		for ( i = 0; i < ammodepot.cache.length; ++i ) {
			a = ammodepot.cache[i];
			
			if ( !a.active ) 
				continue;
			
			entity.draw( a );
		}
	};
	
	ammodepot.cleanup = _fn;
	ammodepot.destroy = _fn;
	
	// =========================================================================
	// Astroids
	
	var ASTROID_SIZE_MIN 	= 20;
	var ASTROID_SIZE_MAX 	= 40;
	var ASTROID_LIMIT 		= 30;
	var ASTROID_DRIFT_SPEED = 2;
	var ASTROID_WORTH 		= 20;
	var ASTROID_SPAWN_TIME 	= 1;
	
	// -------------------------------------------------------------------------
	
	function Astroid (x,y) {
		this.pos = vec3.create([ x, y, 0 ]);
		this.dir = vec3.normalize([x,y,0]);
		this.rot = _w.quat.fromAxis([0,0,1], 0); // orientation
		this.active = true;
		this.speed = ASTROID_DRIFT_SPEED;
		this.worth = ASTROID_WORTH;
		this.damage = 5;
	}
	
	Astroid.prototype.hit = function ( ent ) {
		astroidbelt.remove( this );
	};
	
	// -------------------------------------------------------------------------
	
	var astroidbelt = { cache : [] };
	
	astroidbelt.init = function () {
		astroidbelt.prepare();
	};
	
	astroidbelt.prepare = function () {
		astroidbelt.cache = [];
	};
	
	astroidbelt.add = function () {
		if ( astroidbelt.cache.length > ASTROID_LIMIT ) 
			return;
		
		var a_size 	= ASTROID_SIZE_MIN 
					+ ( Math.random() * ( ASTROID_SIZE_MAX - ASTROID_SIZE_MIN ) );
		
		// get random position on the screen, not too close to the edge
		var w = gl.viewportWidth  - 2*a_size;
		var h = gl.viewportHeight - 2*a_size;
		var x = Math.random()*w - w/2;
		var y = Math.random()*h - h/2;
		
		logger.debug( _w.strf( 'new {2}m astroid @ [ {0}, {1} ]', x, y, a_size) );
		
		// create the astroid
		var a = new Astroid( x,y );
		var r = a.radius = a_size/2;
		a.damage = Math.floor( a_size );
		
		var buffs = {};
		var verts = [   0,   r, 0,
					    r, r/2, 0,
					    r,-r/2, 0,
					 -r/4,  -r, 0,
					   -r,   0, 0];
		buffs.v = gl.createBuffer();
		buffs.v.size = 3;
		buffs.v.count = 5;

		var colors = [];
		for ( var i = 0; i < buffs.v.count; ++i )
			colors = colors.concat([ .75, .75, .75, 1.0 ]); // grey
		buffs.c = gl.createBuffer();
		buffs.c.size = 4;
		buffs.c.count = buffs.v.count;
		
		var indices = [ 0,1,2
					  , 0,2,3
					  , 0,3,4 ];
		buffs.i = gl.createBuffer();
		buffs.i.size = 1;
		buffs.i.count = 3*3;
		
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.v ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), gl.STATIC_DRAW );
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.c ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffs.i ); 	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
		
		a.buffs = buffs;
		
		astroidbelt.cache.push( a );
	};
	
	astroidbelt.remove = function (ent) {
		var c = astroidbelt.cache, l = c.length, i = 0;
		for ( i=0; i<l; ++i ) if ( c[i] == ent ) { c.splice( i, 1 ); --l; }
	};
	
	astroidbelt.step = function () {
		var a, i;
		
		if ( timer.time % ASTROID_SPAWN_TIME < timer.etime )
			astroidbelt.add();
			
		for ( i = 0; i < astroidbelt.cache.length; ++i ) {
			a = astroidbelt.cache[i];
			if ( !a.active ) continue;
			
			a.worth -= timer.etime;
			
			// drift...
			var angle = _w.deg2rad( 360/a.radius * timer.etime );
			var q = _w.quat.fromAxis( [0,0,1], angle );
			quat4.multiply( q, a.rot, a.rot );
			
			var d = vec3.scale( vec3.create( a.dir ), a.speed );
			vec3.add( a.pos, d );
			wrap_edge( a );
		}
	};
	
	astroidbelt.draw = function () {
		var a, i;
		for ( i = 0; i < astroidbelt.cache.length; ++i ) {
			a = astroidbelt.cache[i];
			if ( a.active ) entity.draw( a );
		}
	};
	
	astroidbelt.cleanup = _fn;
	astroidbelt.destroy = _fn;
	
	// =========================================================================
	// Gravity Well
	
	var gravitywell = {};
	
	gravitywell.init = function(){
		var ent = {};
		ent.pos = [-100,0,0];
		ent.rot = _w.quat.fromAxis( [0,0,1], 0 );
		ent.damage = 1000000;
		
		var r = ent.radius = 10;
		
		var buffs = {};
		//var verts = [ Math.cos(  0)*r, Math.sin(  0)*r, 0,
		//			  Math.cos( 90)*r, Math.sin( 90)*r, 0,
		//			  Math.cos(180)*r, Math.sin(180)*r, 0,
		//			  Math.cos(270)*r, Math.sin(270)*r, 0];
		
		var verts = [ r, 0, 0,
					  0, r, 0,
					 -r, 0, 0,
					  0,-r, 0];
		
		logger.info( 'gravity well verts: ' + _w.tostr( verts ) );
		buffs.v = gl.createBuffer();
		buffs.v.size = 3;
		buffs.v.count = 4;

		var colors = [];
		for ( var i = 0; i < 4; ++i )
			colors = colors.concat( [ 1.0, 0.9, 0.2, 1.0 ] ); // yellow
		buffs.c = gl.createBuffer();
		buffs.c.size = 4;
		buffs.c.count = 4;
		
		var indices = [ 0,1,2 , 0,2,3 ];
		buffs.i = gl.createBuffer();
		buffs.i.size = 1;
		buffs.i.count = 6;
		
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.v ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), gl.STATIC_DRAW );
		gl.bindBuffer( gl.ARRAY_BUFFER, buffs.c ); 			gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffs.i ); 	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
		
		ent.buffs = buffs;
		
		gravitywell.entity = ent;
	};
	
	gravitywell.step = function () {
		var gwell = gravitywell.entity;
		
		var entities = [].concat( astroidbelt.cache, shipyard.cache );
		var i, ent, l = entities.length;
		for ( i=0; i<l; ++i ) {
			ent = entities[ i ];
			pull ( gwell, ent );
			
			if ( collide( gwell, ent ) )
				ent.hit( gwell );
		}
	};
	gravitywell.draw 	= function () { entity.draw( gravitywell.entity ); };
	
	gravitywell.prepare = _fn;
	gravitywell.cleanup = _fn;
	gravitywell.destroy = _fn;
	
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