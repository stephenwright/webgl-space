/** @file main.js */
var CODEWILL = (function(){

	var API = {};
	
	var logger = _w.getLogger();
	var ctx;
	
	// ===========================================================================
	// Initialization
	
	API.init = function () {
		logger.attach( $('#console').get(0) );
		logger.info( 'init' );
		
		var canvas = document.getElementById('portal');
		if (!canvas.getContext)
			return alert( 'no context :(' );
			
		ctx = canvas.getContext('2d');
	};
	
	// ===========================================================================
	
	function test_char(){
		var s = " !\"#$%&'()*+,-./0@ABCDEFGHIJKLMNOPQRSTUVWXYZ`abcdefghijklmnpqrstuvwxyz";
		for ( var i = 0; i < s.length; ++i ) {
			var ch = s[i];
			var p = ch.charCodeAt() - 32;
			var r = Math.floor( p / 16 );
			var c = p % 16;
			logger.info( _w.strf( "{0} = {1:2} + ({2:2},{3:2})", ch, p, c, r ) );
		}
	}
	
	// ===========================================================================
	// And we're done! return the public functions
	return API;
})();

$(CODEWILL.init);