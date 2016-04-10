// http://www.bennadel.com/blog/2662-my-first-look-at-streams-in-node-js.htm
// Include module references.
var fileSystem = require( "fs" );
var stream = require( "stream" );
var util = require( "util" );

// I am a Transform stream (writable/readable) that takes input and finds matches to the
// given regular expression. As each match is found, I push each match onto the output
// stream individually.
function RegExStream( pattern ) {
	// If this wasnt' invoked with "new", return the newable instance.
	if ( ! ( this instanceof RegExStream ) ) {
		return( new RegExStream( pattern ) );
	}

	// Call super-constructor to set up proper options. We want to set objectMode here
	// since each call to read() should result in a single-match, never a partial match
	// of the given regular expression pattern.
	stream.Transform.call(this,{objectMode: true});

	// Make sure the pattern is an actual instance of the RegExp object and not just a
	// string. This way, we can treat it uniformly later on.
	if ( ! ( pattern instanceof RegExp ) ) {
		pattern = new RegExp( pattern, "g" );
	}

	// Since the patter is passed-in by reference, we need to create a clone of it
	// locally. We're doing to be changing the RegExp properties and we need to make
	// sure we're not breaking encapsulation by letting the calling scope alter it.
	this._pattern = this._clonePattern( process.argv );

	// I hold the unprocessed portion of the input stream.
	this._inputBuffer = "";
}

// Extend the Transform class.
// --
// NOTE: This only extends the class methods - not the internal properties. As such we
// have to make sure to call the Transform constructor (above).
util.inherits( RegExStream, stream.Transform );


// I clone the given regular expression instance, ensuring a unique refernce that is
// also set to include the "g" (global) flag.
RegExStream.prototype._clonePattern = function( pattern ) {
	var parts = "[^";
	for (var i = 3; i < process.argv.length; i++){
		parts += process.argv[i].toString();
	}
	parts += "]+"
	// parts = ""
	return (new RegExp(parts, "g"));
};

// I transform the given input chunk into zero or more output chunks.
RegExStream.prototype._transform = function( chunk, encoding, getNextChunk ) {
	console.log("\n--------------------------Input--------------------------\n")
	console.log(chunk.toString( "utf8" ) );
	console.log("\n-------------------------Output--------------------------\n")

	// Add the chunk to the internal buffer. Since we might be matching values across
	// multiple chunks, we need to build up the buffer with each unused chunk.
	this._inputBuffer += chunk.toString( "utf8" );

	// Since we don't want to keep building a large internal buffer, we want to pair-
	// down the content that we no longer need. As such, we're going to keep track of the
	// the position of the last relevant index so that we can drop any portion of the
	// content that will not be needed in the next chunk-processing.
	var nextOffset = null;

	var match = null;

	// Loop over the matches on the buffered input.
	while ( ( match = this._pattern.exec( this._inputBuffer ) ) !== null ) {
		// If the current match is within the bounds (exclusive) of the input buffer,
		// then we know we haven't matched a partial input. As such, we can safely push
		// the match into the output.
		// if ( this._pattern.lastIndex-1 < this._inputBuffer.length ) { // answer as of now
		if ( this._pattern.lastIndex < this._inputBuffer.length ) {
			// console.log( "Push:", match[ 0 ] );
			this.push( match[ 0 ] );
			// The next relevant offset will be after this match.
			nextOffset = this._pattern.lastIndex;
		// If the current match butts up against the end of the input buffer, we are in
		// danger of an invalid match - a match that will actually span across two (or
		// more) successive _write() actions. As such, we can't use it until the next
		// write (or finish) event.
		} 
	}

	// If we have successfully consumed a portion of the input, we need to reduce the
	// current input buffer to be only the unused portion.
	if ( nextOffset !== null ) {
		this._inputBuffer = this._inputBuffer.slice( nextOffset );
	// If no match was found at all, then we can reset the internal buffer entirely. We
	// know we won't need to be matching across chunks.
	} else {
		this._inputBuffer = "";
	}
	// Reset the regular expression so that it can pick up at the start of the internal
	// buffer when the next chunk is ready to be processed.
	this._pattern.lastIndex = 0;
	// Tell the source that we've fully processed this chunk.
	console.log("\n");
	getNextChunk();
};

// Create an input stream from the file system.
var inputStream = fileSystem.createReadStream( "./input-sensor.txt" );

// Create a Regular Expression stream that will run through the input and find matches
// for the given pattern - "words".
var regexStream = inputStream.pipe( new RegExStream( /\w+/i ) );

// When the regex stream is ready, start reading-in word matches.
var count = 0
regexStream.on(
	"readable",
	function() {
		var content = null;
		// Since the RegExStream operates on "object mode", we know that we'll get a
		// single match with each .read() call.
		while ( content = this.read() ) {
			console.log(content.toString( "utf8" ) );
			count++
		}
		// console.log(count)
	}
	);
