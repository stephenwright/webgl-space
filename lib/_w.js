/** @file _w.js 
 *
 * Javascript utility library created by Stephen Wright
 */
var _w = (function(){

	var API = {};
	
	/**
	 * Math
	 */
	API.deg2rad = function (d) { return d*(Math.PI/180); }
	
	// Vectors
	var vec = {};
	vec.right 	= [1,0,0];
	vec.forward = [0,1,0];
	vec.up 		= [0,0,1];
	vec.tostr = function (v,p) {
		p = p || 0;
		return API.strf('[ {0}, {1}, {2} ]', 
			v[0].toFixed(p), 
			v[1].toFixed(p), 
			v[2].toFixed(p)); 
	};
	API.vec = vec;
	
	// Quaternions
	var quat = {};
	quat.fromAxis = function (v, angle) {
		angle *= 0.5;
		var x,y,z,w, sin_a = Math.sin( angle );
	 
		x = ( v[0] * sin_a );
		y = ( v[1] * sin_a );
		z = ( v[2] * sin_a );
		
		w = Math.cos( angle );
		
		return [x,y,z,w];
	};
	API.quat = quat;
	
	// Matrices
	var mat = {};
	/**
	 * @param l - left
	 * @param r - right
	 * @param b - bottom
	 * @param t - top
	 * @param n - near
	 * @param f - far
	 * @param m - [out] matrix (optional)
	 */
	mat.ortho = function (l, r, b, t, n, f, m) {
		m = m || [];
		m[0]  = 2 / (r-l);
		m[1]  = 0;
		m[2]  = 0;
		m[3]  = 0;

		m[4]  = 0;
		m[5]  = 2 / (t-b);
		m[6]  = 0;
		m[7]  = 0;

		m[8]  = 0;
		m[9]  = 0;
		m[10] = -2 / (f-n);
		m[11] = 0;

		m[12] = -(r+l) / (r-l);
		m[13] = -(t+b) / (t-b);
		m[14] = -(f+n) / (f-n);
		m[15] = 1;

		return m;
	}
	API.mat = mat;
	
	/**
	 * Overrides the target with all attributes from the source object
	 *
	 * @param trg - the target object, to be overridden
	 * @param src - the source object, who's attributes are to be copied on the target
	 * @return the target object extended by the source object
	 */
	API.extend = function (trg, src) {
		for (att in trg)
			trg[att] = src[att]; 
		return trg; 
	}
	
	/**
	 * Create a logging object
	 */
	API.getLogger = function (element, level) {
		var l = {};
		
		l.el 	= element || null;
		l.level = level || 5;
		l.cache = [];
		
		function log_cache (msg, lvl) { l.cache.push([msg,lvl]); }
		function log_out (msg, lvl) {
			if ( lvl > l.level ) return;
			var li = document.createElement('li');
			li.appendChild( document.createTextNode( msg ) );
			l.el.appendChild( li );
			l.el.scrollTop = l.el.scrollHeight; 
		}
		l.log = log_cache;
		l.attach = function (e) {
			if (e==null) { l.log = log_cache; return; }
			l.el = document.createElement('ul');
			l.el.id = "logger_output";
			e.appendChild( l.el );
			l.log = log_out;
			while (l.cache.length>0){
				var o = l.cache.shift();
				l.log(o[0],o[1]);
			}
		}
		l.fatal = function ( msg ) { l.log( msg, 1 ); }
		l.error = function ( msg ) { l.log( msg, 2 ); }
		l.warn  = function ( msg ) { l.log( msg, 3 ); }
		l.info  = function ( msg ) { l.log( msg, 4 ); }
		l.debug = function ( msg ) { l.log( msg, 5 ); }
		l.trace = function ( msg ) { l.log( msg, 6 ); }
		return l;
	}
	
	/**
	 * Pad a number with whitespace so that it's the specified length
	 * @param n - number
	 * @param l - length to pad
	 */
	API.pad = function (n,l) {
		for ( var i = n.toString().length; i < l; ++i )
			n = ' ' + n;
		return n;
	}
	
	/**
	 * String format ( str, ... )
	 * usage: strf( "{0} + {1} = {2:5}", 10, 8, (10+8) ); 
	 * returns: "10 + 8 =    18"
	 */
	API.strf = function () {
		var args = arguments;
		var s = Array.prototype.shift.call(args);
		// replace matches with padding first
		s = s.replace(/{(\d+):(\d+)}/g, function(match, n, p) {
			return typeof args[n] != 'undefined' ? API.pad(args[n],p) : match;
		});
		// replace the remaining place holders
		s = s.replace(/{(\d+)}/g, function(match, n) {
			return typeof args[n] != 'undefined' ? args[n] : match;
		});
		return s;
	}
	
	/**
	 * Get the string representation of a specified parameter in an object
	 * 
	 * @param k - key/index of parameter
	 * @param obj - object containing desired parameter
	 * @return string representation of the request parameter
	 */
	function param_to_str (k,obj) {
		var v = (k == null ? obj : obj[k]);
		switch (typeof v) {
		case 'string'	: return "'" + v + "'";
		case 'number'	: return '' + v;
		case 'boolean'	:
		case 'null'		: return String(v);
		case 'object'	: 	
			if (v instanceof Array) {
				var a = [];
				for (var i = 0; i < v.length; ++i) a.push( param_to_str(i,v) ); 
				return '[' + a.join(',') +']';
			}
			else
				return obj_to_str(v);
		case 'function'	: return v.toString();
		}
		return 'null';
	}
	
	/**
	 * @param obj - object to be converted to a string in json format
	 * @return string representing the object
	 */
	function obj_to_str (obj) {
		if (typeof obj != 'object' || obj instanceof Array) return param_to_str(null,obj);
		var params = [];
		for (p in obj) params.push('"' + p + '":' + param_to_str(p,obj));
		return '{' + params.join(',') + '}';
	}
	API.tostr = obj_to_str;
	
	/**
	 * Timer
	 */
	var Timer = function () {
		this.time 	= 0.0; 	// total running time
		this.etime 	= 0.0; 	// elapsed time since last tick (seconds)
		this.ptime 	= new Date().getTime();  // previous tick time
		this.is_counting = false;
	}
	Timer.prototype.tick = function () {
		var ctime = new Date().getTime();	// current time
		if ( this.is_counting ) { 
			this.etime = ( ctime - this.ptime ) / 1000;
			this.time += this.etime; 
		}
		this.ptime = ctime;
	}
	Timer.prototype.stop  		= function () { this.is_counting = false; }
	Timer.prototype.start 		= function () { this.is_counting = true; this.ptime = new Date().getTime(); }
	Timer.prototype.reset 		= function () { this.time = 0.0; }
	Timer.prototype.toString 	= function () { return this.time / 1000; }
	
	API.Timer = Timer;
	
	// -------------------------------------------------------------------------
	var _ui = {};
	_ui.tabs = function ( id ) {
		var box = $( '#' + id ).addClass('_wtabs');
		var content = $( '#' + id + ' .content' );
		var ul = document.createElement("ul");
		ul.className = 'tabs';
		content.each(function(){ 
			var li = document.createElement( "li" );
			var  a = document.createElement( "a" );
			var  c = this;
			a.appendChild( document.createTextNode( c.id ) );
			a.name = c.id;
			a.href = "javascript:";
			$(a).click(function(){
				content.hide();
				$(c).show();
				var l = $(this).parent();
				l.parent().children('li').removeClass('active');
				l.addClass('active'); 
			});
			li.className = 'tab';
			li.appendChild(  a );
			ul.appendChild( li );
		});
		box.prepend( ul );
		$(ul).find('a').first().click();
	}
	API.ui = _ui;
	
	return API;
})();