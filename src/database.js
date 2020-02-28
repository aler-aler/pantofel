const Metadata = require ( 'node-id3' );
const MP3Duration = require( 'mp3-duration' );
const fs = require ( 'fs' );
const genres = require( '../genres.json' );

let db = { };

function open ( song ) 
{
    Metadata.read ( `./playlist/${song}`, function ( err, tags ) {
        if ( err )
            logger.error ( err );
        db[song] = {
            artist: tags.artist ? tags.artist : '',
            title: tags.title ? tags.title : '',
            album: tags.album ? tags.album : '',
            image: tags.image ? tags.image.imageBuffer : null,
            mime: tags.image ? tags.image.mime : null,
            genre: !tags.raw ||    !tags.raw.TCON ? 12 
                  : parseInt ( tags.raw.TCON.substr(1) ) != NaN ? parseInt ( tags.raw.TCON.substr(1) )
                  : parseInt ( tags.raw.TCON ) != NaN ? parseInt ( tags.raw.TCON )
                  : 12
        }
        MP3Duration( `./playlist/${song}`, function ( err, duration ) {
              if ( err )
                  logger.log(err.message);
              db[song].duration = duration;
        });
    } );
}

function write ( song )
{
    let tags = db [ song ];
    
    if ( !tags )
        return false;
    
    let kek = 
    {
        TCON: `(${tags.genre})`,
        artist: tags.artist,
        title: tags.title,
        album: tags.album,
        image: tags.image ?
        {
            mime: tags.mime,
            type:
            {
                id: 3,
                name: "front cover"
            },
            description: "pantofel",
            imageBuffer: tags.image
        } : null
    }
    return Metadata.write ( kek, `./playlist/${song}` );
}

fs.readdirSync ( './playlist' ).forEach ( function ( song )
{
    open ( song );
} );

function setArtist ( song, artist ) 
{
    if ( db [ song ] )
        db [ song ].artist = artist;
}

function setTitle ( song, title ) 
{
    if ( db [ song ] )
        db [ song ].title = title;
}

function setAlbum ( song, album ) 
{
    if ( db [ song ] )
        db [ song ].album = album;
}

function setGenre ( song, genre ) 
{
    if ( db [ song ] )
        db [ song ].genre = genre;
}

function setImage ( song, image )
{
    if ( db [ song ] )
    {
        db [ song ].mime = 'jpeg';
        db [ song ].image = image;
    }
}

function getFilenames ( )
{
    return Object.keys ( db );
}

function getTags ( song ) 
{
    if ( !db [ song ] )
        return null;

    let kek = { };
    Object.assign ( kek, db [ song ] );
    if ( genres [ kek.genre ] ) 
    {
        kek.genrename = genres [ kek.genre ].name;
    }
    else
    {
        kek.genre = 12;
        kek.genrename = 'Other';
    }
    return kek;
}

module.exports.open = open;
module.exports.write = write;
module.exports.setArtist = setArtist;
module.exports.setTitle = setTitle;
module.exports.setAlbum = setAlbum;
module.exports.setGenre = setGenre;
module.exports.setImage = setImage;
module.exports.getFilenames = getFilenames;
module.exports.getTags = getTags;