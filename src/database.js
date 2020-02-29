const Metadata = require ( 'node-id3' );
const MP3Duration = require( 'mp3-duration' );
const fs = require ( 'fs' );
const genres = require( '../genres.json' );
const SQL = require('sqlite3').verbose();
const logger = require ( './logger.js' );

let db = new SQL.Database( './db/playlist.db', function ( err )
{
	if (err) 
		logger.error ( 'Database', err.message );
	logger.log( 'Database', 'Connected to the playlist database.');
	db.each ( `SELECT * FROM playlist`, function ( err, row )
	{
		console.log ( row );
	} );
} );


function add ( song ) 
{
    Metadata.read ( `./playlist/${song}`, function ( err, tags ) 
	{
        if ( err )
            logger.error ( 'Database', err );
	
        let genre = !tags.raw ||    !tags.raw.TCON ? 12 
                  : parseInt ( tags.raw.TCON.substr(1) ) != NaN ? parseInt ( tags.raw.TCON.substr ( 1 ) )
                  : parseInt ( tags.raw.TCON ) != NaN ? parseInt ( tags.raw.TCON )
                  : 12;
        MP3Duration ( `./playlist/${song}`, function ( err, duration ) 
		{
            if ( err )
                logger.error( 'Database', err.message);

			db.serialize ( function ( ) 
			{
				db.run ( 'INSERT INTO playlist(id, artist, title, album, genre, duration) VALUES(?,?,?,?,?,?)', 
						 [ song, tags.artist, tags.title, tags.album, genre, duration ], function ( err )
				{
					if ( err ) 
					{
						logger.error( 'Database', err.message );
					}
				} );
			} );
		} );
    } );
}

function update ( song, data, callback )
{
	db.serialize ( function ( ) 
	{
		db.run ( `UPDATE playlist SET id = ?, artist = ?, title = ?, album = ?, genre = ? WHERE id = ?`, [ song, data.artist, data.title, data.album, data.genre, song], function ( err )
		{
			if ( err ) 
			{
				logger.error( 'Database', err.message );
			}
		
			let metadata = 
			{
				TCON: `(${data.genre})`,
				artist: data.artist,
				title: data.title,
				album: data.album
			}
			if ( Metadata.write ( metadata, `./playlist/${song}` ) )
				callback ( );
		} );
	} );
}

function genrename ( tags )
{
	if ( genres [ tags.genre ] ) 
	{
		tags.genrename = genres [ tags.genre ].name;
	}
	else
	{
		tags.genre = 12;
		tags.genrename = 'Other';
	}
	return tags;
}

function getAllTags ( callback ) 
{
	db.serialize ( function ( )
	{
		db.all ( `SELECT * FROM playlist`, [ ], function ( err, rows )
		{
			if ( err ) 
			{
				logger.error ( 'Database', err.message );
				reject ( );
			}
			
			for ( let i = 0; i < rows.length; ++i )
			{
				genrename ( rows [ i ] );
			}
			callback ( rows );
		} );
	} );
}

function getTags ( song, callback ) 
{
	db.serialize ( function ( )
	{
		db.all ( `SELECT * FROM playlist WHERE id = ?`, [ song ], function ( err, rows )
		{
			if ( err ) 
			{
				logger.error ( 'Database', err.message );
			}
			else if ( rows.length === 0 )
			{
				logger.error ( 'Database', `Cannot find ${song}` );
			}
			else
			{
				callback ( genrename ( rows [ 0 ] ) );
			}
		} );
	} );
}

module.exports.add = add;
module.exports.update = update;
module.exports.getAllTags = getAllTags;
module.exports.getTags = getTags;