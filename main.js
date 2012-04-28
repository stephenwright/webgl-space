/** @file main.js */
(function( API ){

	var logger 		= API.logger;
	var timer 		= API.timer;
	var gl;
	
	var app 		= new API.Module();
	var root_node 	= new API.Node();
	
	var mainship;
	var score 		= 0;
	
	var map = { 
		"width": 1200, "height": 800 
	};
	
	function node_call ( node, fn ) { 
		node[ fn ].call( node );
		_.each( node.children, function (n) { node_call( n, fn ); } );
	}
	
	function buffs_gen ( verts, colors, indices, txCoords ) {
		var b = {};
		
		b.v = gl.createBuffer();
		b.c = gl.createBuffer();
		b.i = gl.createBuffer();
		
		b.v.size = 3;
		b.c.size = 4;
		b.i.size = 1;
		
		b.v.count = verts.length / 3;
		b.c.count = colors.length / 4;
		b.i.count = indices.length;
		
		gl.bindBuffer( gl.ARRAY_BUFFER, b.v );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( verts ), 	gl.STATIC_DRAW );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, b.c );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.STATIC_DRAW ); 
		
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, b.i );
		gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );
		
		API.glErrorCheck( "main.buffs_gen" );
		return b;
	}
	
	// =========================================================================
	
	app.init = function () {
		logger.info('app.init');
		gl = API.context;
		
		node_call( root_node, 'init' );
	};
	
	app.prepare = function () {
		node_call( root_node, 'prepare' );
	};
	
	var EDGE_TOLERANCE = 200;
	
	app.step = function () {
		node_call( root_node, 'step' );
		
		// keep the camera on the main ship
		var Pt = mainship.pos; // position of target being tracked
		var Pc = vec3.create( API.camera.pos ); // position of the camera
		
		var d = vec3.subtract( Pt, Pc, [] );
		var e = EDGE_TOLERANCE;
		
		var mw = map.width/2;
		var mh = map.height/2;
		
		var vw = (gl.viewportWidth/2)  - e;
		var vh = (gl.viewportHeight/2) - e;
		
		// width
		if ( d[0] - vw > 0 ) Pc[0] += d[0] - vw;
		if ( d[0] + vw < 0 ) Pc[0] += d[0] + vw;
		
		// height
		if ( d[1] - vh > 0 ) Pc[1] += d[1] - vh;
		if ( d[1] + vh < 0 ) Pc[1] += d[1] + vh;
		
		// edge tolerance no longer applies for this next section
		vw += e;
		vh += e;
		
		// keep camera on the map
		if ( Pc[0] + vw > mw ) Pc[0] = mw - vw;
		if ( Pc[0] - vw <-mw ) Pc[0] = -(mw - vw);
		
		if ( Pc[1] + vh > mh ) Pc[1] = mh - vh;
		if ( Pc[1] - vh <-mh ) Pc[1] = -(mh - vh);
		
		// move the camera 
		vec3.subtract( Pc, API.camera.pos );
		if ( vec3.length( Pc ) > 0 )
			API.camera.move( Pc );
	};
	
	app.draw = function () {
		var info = '';
		info += _w.strf('viewport: [ {0}, {1} ]<br/>', gl.viewportWidth, gl.viewportHeight );
		var s = timer.time;
		info += _w.strf('time:  {0}m{1}s<br/>', (s/60).toFixed(0), ((s%60)).toFixed(2) );
		info += _w.strf('etime: {0}<br/>', timer.etime );
		info += _w.strf('fps:   {0}<br/>', API.fps );

		info += '<h6>camera</h6>';
		info += _w.strf('camera.pos:      {0}<br/>', _w.vec.tostr( API.camera.pos ) );
		//info += _w.strf('camera.trg:      {0}<br/>', _w.vec.tostr( API.camera.trg ) );
		//info += _w.strf('camera.up:       {0}<br/>', _w.vec.tostr( API.camera.up ) );
		
		info += '<h6>mainship</h6>';
		info += _w.strf('ship.pos:      {0}<br/>', _w.vec.tostr( mainship.pos ) );
		info += _w.strf('ship.velocity: {0}<br/>', _w.vec.tostr( mainship.velocity, 2 ) );
		info += _w.strf('ship.speed:    {0}<br/>', vec3.length(  mainship.velocity ) );
		info += _w.strf('ship.thrust:   {0}<br/>', mainship.thrust );

		$( '#info' ).html( info );
		$( '#scoreboard' ).html( _w.strf( 'sheild {0} :: score {1}', mainship.sheild, score ) );
		
		node_call( root_node, 'draw' );
	};
	
	app.cleanup = function () {
		node_call( root_node, 'cleanup' );
	};
	
	app.destroy = function () {
		node_call( root_node, 'destroy' );
	};
	
	// load the app into the engine
	API.loadModule( app );
	
	// =========================================================================
	
	/**
	 * wrap entities around the edge of the screen
	 */
	function wrap_edge ( ent ) {
		var w = map.width /2;
		var h = map.height/2;
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
	 * @param ent - an entity
	 * @param f - force being applied (vec3)
	 */
	function apply_force ( ent, f ) {
		vec3.add( ent.velocity, f );
	}
	
	var G = 6.9e-6;
	
	/**
	 * pull the target (trg) towards the source (src)
	 */
	function pull ( src, trg ) {
		var d = vec3.subtract( src.pos, trg.pos, [] );
		var r = vec3.length( d );
		var m1 = src.mass;
		var m2 = trg.mass;
		var F = G * ( m1*m2 / r*r );
		
		vec3.normalize( d );
		vec3.scale( d, F * timer.etime );
		
		apply_force( trg, d );
	}
	
	// =========================================================================
	// Ships 
	
	// Movement Constants
	var ROTATE_SPEED 		= 360;
	var MAX_SPEED 			= 240;
	var MIN_SPEED 			=   0;
	var MAX_THRUST 			= 180;
	var DECELERATION_RATE 	=  20;
	var ACCELERATION_RATE 	= MAX_THRUST/2;
	
	// -------------------------------------------------------------------------
	
	function Ship () {
		this.pos = vec3.create( [0,30,0] );
		this.rot = _w.quat.fromAxis( [0,0,1], 0 ); // orientation
		
		this.velocity = vec3.create();
		
		this.firing = false;
		this.radius = 5;
		this.thrust = 0;
		this.sheild = 100;
		this.mass 	= 300;
	}
	
	Ship.prototype = new API.Node();
	
	Ship.prototype.hit = function ( ent ) {
		this.sheild -= ent.damage;
	}
	
	// -------------------------------------------------------------------------
	
	// space based movement, drifting
	function move_space ( ship, amount ) {
	
		var speed = vec3.length( ship.velocity );
		var dir = vec3.normalize( ship.velocity, [] );
		
		// decelerate if moving
		if ( speed != 0 ) {
			var rd = vec3.scale( dir, -DECELERATION_RATE * timer.etime, [] );
			vec3.add( ship.velocity, rd );
		}
		
		// calculate thrust
		ship.thrust = amount > 0 ? Math.min( ship.thrust + ACCELERATION_RATE, MAX_THRUST ) : 0;
		
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
	}
	
	// -------------------------------------------------------------------------
	var shipyard = new API.Module();
	
	shipyard.init = function () {
		this.prepare();
	};
	
	shipyard.prepare = function () {
		this.cache = [];
		mainship = this.build();
		mainship.pos = [-200,-60,0];
	};
	
	shipyard.build = function () {
		var ship = this.get();
		this.cache.push(ship);
		return ship;
	};
	
	shipyard.get = function () {
		var ship = new Ship();
		
		var indices = [ 0,1,2 , 3,4,5 ];
		var verts = [-5, -5, 0,
					  5, -5, 0,
					  0, 10, 0,
					// tail
					 -3, -5, 0,
					  3, -5, 0,
					  0,-12, 0];
					  
		var colors = [];
		for ( var i = 0; i < 3; ++i )
			colors = colors.concat( [ 0.0, 1.0, 0.0, 1.0 ] ); // green
		for ( var i = 0; i < 3; ++i )
			colors = colors.concat( [ 1.0, 0.0, 0.0, 1.0 ] ); // red 
		
		ship.buffs = buffs_gen( verts, colors, indices );
		
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
			var q = _w.quat.fromAxis([0,0,1], -angle);
			quat4.multiply( q, mainship.rot, mainship.rot );
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
		var fire_key_down 
			 = API.keys.press( API.K.shift ) 
			|| API.keys.press( API.K.s ) 
			|| API.keys.press( API.K.down );
			
		if ( !mainship.firing && fire_key_down ) {
			var p = vec3.create( mainship.pos );
			var d = quat4.multiplyVec3( mainship.rot, [0,1,0] )
			var offset = vec3.scale( d, mainship.radius + AMMO_RADIUS + 1 );
			vec3.add( p, offset );
		
			ammodepot.fire( p, mainship.rot );
			mainship.firing = true;
			
			var dir = quat4.multiplyVec3( ship.rot, [0,1,0] );
			apply_force( mainship, vec3.scale( dir, -3 ) );
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
		var i, s, l;
		for ( i = 0, l = this.cache.length; i < l; ++i ) {
			s = this.cache[i];
			
			// show the tail if accelerating
			s.buffs.i.count = s.thrust ? 6 : 3;
			
			API.entity.draw( s );
		}
	};
	
	API.loadModule( shipyard );
	
	// =========================================================================
	// Ammo
	
	var AMMO_SPEED 		= 300;
	var AMMO_LIFESPAN 	= 2;
	var AMMO_RADIUS 	= 3;
	
	// -------------------------------------------------------------------------
	
	function Rocket () {
		this.lifespan 	= AMMO_LIFESPAN;
		this.radius 	= AMMO_RADIUS;
		this.active 	= true;
		this.damage 	= 10;
		this.velocity 	= vec3.create();
		this.mass		= 1000;
	}
	Rocket.prototyp = new API.Node();
	
	Rocket.prototype.hit = function ( ent ) {
	};
	
	// -------------------------------------------------------------------------
	
	var ammodepot = new API.Module();
	
	ammodepot.init = function () {
		this.cache_size = 100;
		this.prepare();
	};
	
	ammodepot.prepare = function () {
		this.cache = [];
	};
	
	ammodepot.fire = function (pos, rot) {
		logger.trace('fire!');
		
		var a = ammodepot.get();
		
		if ( a == null ) 
			return;
		
		var dir 	= quat4.multiplyVec3( rot, [0,1,0] );
		a.velocity 	= vec3.scale( dir, AMMO_SPEED );
		a.pos 		= vec3.create( pos );
		a.rot 		= quat4.create( rot );
		a.lifespan 	= AMMO_LIFESPAN;
		a.active 	= true;
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
		
		var verts = [-2, -3, 0,
					  2, -3, 0,
					  0,  3, 0];
					  
		var colors = [];
		for ( var i = 0; i < 3; ++i )
			colors = colors.concat( [ 1.0, 1.0, 1.0, 1.0 ] ); // white
		
		var indices = [ 0,1,2 ];
		
		a.buffs = buffs_gen( verts, colors, indices );
		
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
			var d = vec3.scale( a.velocity , timer.etime, [] );
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
			
			API.entity.draw( a );
		}
	};
	
	API.loadModule( ammodepot );
	
	// =========================================================================
	// Astroids
	
	var ASTROID_SIZE_MIN 	= 20;
	var ASTROID_SIZE_MAX 	= 40;
	var ASTROID_LIMIT 		= 30;
	var ASTROID_DRIFT_SPEED = 60;
	var ASTROID_WORTH 		= 20;
	var ASTROID_SPAWN_TIME 	= 1;
	
	// -------------------------------------------------------------------------
	
	function Astroid (pos, size) {
		this.pos 		= vec3.create( pos );
		this.active 	= true;
		this.worth 		= ASTROID_WORTH;
		this.damage 	= 5;
		this.mass 		= size * 100;
		
		vec3.normalize( pos );
		vec3.cross( pos, [0,0,1]);
		this.velocity 	= vec3.scale( pos, ASTROID_DRIFT_SPEED );
	}
	Astroid.prototype = new API.Node();
	
	Astroid.prototype.hit = function ( ent ) {
		astroidbelt.remove( this );
	};
	
	// -------------------------------------------------------------------------
	
	var astroidbelt = new API.Module();
	
	astroidbelt.init = function () {
		this.prepare();
	};
	
	astroidbelt.prepare = function () {
		this.cache = [];
	};
	
	astroidbelt.add = function () {
		if ( this.cache.length > ASTROID_LIMIT ) 
			return;
		
		var a_size 	= ASTROID_SIZE_MIN 
					+ ( Math.random() * ( ASTROID_SIZE_MAX - ASTROID_SIZE_MIN ) );
		
		// get random position on the screen, not too close to the edge
		var w = map.width  - 4*a_size;
		var h = map.height - 4*a_size;
		var n = Math.min(h,w);
		var x = Math.random()*n/2;
		var y = Math.random()*n/2;
		
		//logger.debug( _w.strf( 'new {2}m astroid @ [ {0}, {1} ]', x, y, a_size) );
		
		// create the astroid
		var a = new Astroid( [x,y,0], a_size );
		var r = a.radius = a_size/2;
		a.damage = Math.floor( a_size );
		
		var verts = [   0,   r, 0
					,   r, r/2, 0
					,   r,-r/2, 0
					,-r/4,  -r, 0
					,  -r,   0, 0 ];

		var colors = [];
		for ( var i = 0; i < verts.length; ++i )
			colors = colors.concat([ .75, .75, .75, 1.0 ]); // grey
		
		var indices = [ 0,1,2
					  , 0,2,3
					  , 0,3,4 ];
					  
		a.buffs = buffs_gen( verts, colors, indices );
		
		this.cache.push( a );
	};
	
	astroidbelt.remove = function (ent) {
		var c = this.cache, l = c.length, i = 0;
		for ( i=0; i<l; ++i ) if ( c[i] == ent ) { c.splice( i, 1 ); --l; }
	};
	
	astroidbelt.step = function () {
		var a, i, j, l;
		
		if ( timer.time % ASTROID_SPAWN_TIME < timer.etime )
			this.add();
		
		l = this.cache.length;
		for ( i=0; i<l; ++i ) {
			a = this.cache[i];
			if ( !a.active ) continue;
			
			// pull astroids towards each other
			//for ( j=0; j<l; ++j  ) { var b = this.cache[j]; if (a != b) pull( a, b ); }
			
			// reduce value over time
			a.worth -= timer.etime;
			
			// drift...
			var angle = _w.deg2rad( 1000/a.radius * timer.etime );
			var q = _w.quat.fromAxis( [0,0,1], angle );
			quat4.multiply( a.rot, q );
			
			var d = vec3.scale( a.velocity, timer.etime, [] );
			vec3.add( a.pos, d );
			wrap_edge( a );
		}
	};
	
	astroidbelt.draw = function () {
		var a, i, l = this.cache.length;
		for ( i=0; i<l; ++i ) {
			a = this.cache[i];
			if ( a.active ) API.entity.draw( a );
		}
	};
	
	astroidbelt.get_info = function () {
		var a, i, info = '';
		for ( i = 0; i < this.cache.length; ++i ) {
			a = this.cache[i];
			info += _w.strf( 'pos:{0}, velocity:{1}', _w.vec.tostr(a.pos), _w.vec.tostr(a.velocity) );
		}
		return info;
	};
	
	API.loadModule( astroidbelt );
	
	// =========================================================================
	// Gravity Well
	
	var gravitywell = new API.Node();
	
	gravitywell.init = function(){
		this.damage = 1.0e4;
		this.mass 	= 1.0e4;
		
		var r = this.radius = 5;
		
		var verts = [ r, 0, 0,
					  0, r, 0,
					 -r, 0, 0,
					  0,-r, 0];
		//logger.info( 'gravity well verts: ' + _w.tostr( verts ) );

		var colors = [];
		for ( var i = 0; i < 4; ++i )
			colors = colors.concat( [ 1.0, 0.9, 0.2, 1.0 ] ); // yellow
		
		var indices = [ 0,1,2 , 0,2,3 ];
		this.buffs = buffs_gen( verts, colors, indices );
	};
	
	gravitywell.step = function () {
		var entities = [].concat( astroidbelt.cache, shipyard.cache, ammodepot.cache );
		var i, ent, l = entities.length;
		for ( i=0; i<l; ++i ) {
			ent = entities[ i ];
			pull( this, ent );
			
			if ( collide( this, ent ) )
				ent.hit( this );
		}
	};
	
	gravitywell.draw = function () { API.entity.draw( this ); }
	
	
	root_node.children.push( gravitywell );
	
	// =========================================================================

	$(function(){
		_w.ui.tabs( 'tabs' );
	});
	
})( CODEWILL );
