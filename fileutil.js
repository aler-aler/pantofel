const ffmpeg = require ( 'ffmpeg' );
const fs = require ( 'fs' );
const crypto = require ( 'crypto' );
const { exec } = require ( 'child_process' );

const Config = require ( './config.json' );
const logger = require ( './logger.js' );

function handleUploadedFile ( filename, callback, error )
{
    exec ( Config.probe_command + ' ' + filename, function ( err, stdout, stderr )
    {
        if ( err ) return error ( err );
        
        try
        {
            let response = JSON.parse ( stdout );

            if ( response.streams.length == 1 && response.streams[0].codec_name == 'mp3' && response.format.format_name == 'mp3' ) 
            {
                let name = crypto.randomBytes ( 12 ).toString ( 'hex' );

                fs.renameSync ( filename, './playlist/' + name + '.mp3' );
                logger.log ( '[Info/WebServer] Added new music ' + name );
                return callback ( name );
            }
            else 
            {
                return error ( );
            }
        } catch ( exception )
        {
            fs.unlinkSync ( filename );

            logger.error ( exception );
            error ( exception );
        }
    } );
}

module.exports.handleUploadedFile = handleUploadedFile;