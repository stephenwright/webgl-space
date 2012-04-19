/** @file _w.js 
 *
 * Javascript utility library created by Stephen Wright
 */
var _w = (function(){

	var API = {};
	
	/**
	 * Overrides the target with all attributes from the source object
	 *
	 * @param trg - the target object, to be overridden
	 * @param src - the source object, who's attributes are to be copied on the target
	 * @return the target object extended by the source object
	 */
	API.extend = function (trg, src) { 
		for (att in trg) 
			if (src[att] !== undefined) 
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
		for (p in obj) params.push(p + ':' + param_to_str(p,obj));
		return '{' + params.join(',') + '}';
	}
	API.tostr = obj_to_str;
	
	/**
	 * Timer
	 */
	var Timer = function () {
		this.etime;              // elapsed time since last tick
		this.ptime = new Date().getTime();  // previous tick time
		this.time = 0.0;
		this.is_counting = false;
	}
	Timer.prototype.tick = function () {
		var ctime = new Date().getTime();   // current time
		this.etime = ctime - this.ptime;
		this.ptime = ctime;
		if ( this.is_counting ) { this.time += this.etime; }
	}
	Timer.prototype.stop  		= function () { this.is_counting = false; }
	Timer.prototype.start 		= function () { this.is_counting = true; }
	Timer.prototype.reset 		= function () { this.time = 0.0; }
	Timer.prototype.toString 	= function () { return this.time / 1000; }
	
	API.Timer = Timer;
	
	return API;
})();