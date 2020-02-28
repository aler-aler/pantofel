const MusicBot = require ( './musicbot.js' );
const Config = require ( '../config.json' );
const logger = require ( './logger.js' );

const https = require ( 'https' );
const fs = require ( 'fs' );
const url = require ( 'url' );
const path = require ( 'path' );
const crypto = require ( 'crypto' );
const Cookies = require ( 'cookies' );

logger.initialize ( );

const mimeTypes =
{
    'js':         'application/javascript',
    'json':     'application/json',
    'ogg':         'application/ogg',
    'mp3':         'audio/mpeg',
    'wav':         'audio/x-wav',
    'gif':         'image/gif',
    'jpg':         'image/jpeg',
    'jpeg':     'image/jpeg',
    'png':         'image/png',
    'css':         'text/css',
    'html':     'text/html',
    'xml':         'text/xml',
    'txt':        'text/plain'
};

const options =
{
    key: fs.readFileSync ( Config.https.key ),
    cert: fs.readFileSync ( Config.https.cert )
};

let requestHandlers = { };

function renderTemplate ( template, request, response, data )
{
    let filepath = `./templates/${template}.html`;

    if ( fs.existsSync ( filepath ) )
    {
        let buffer = fs.readFileSync ( filepath ).toString ( );

        // Other templates
        let start;
        let current = 0;
        while( (start = buffer.indexOf ( '{{', current )) !== -1 )
        {
            let end = buffer.indexOf ( '}}', current );
            if( end === -1 )
                break;
            current = end + 1;
            let key = buffer.substr(start + 2, end - start - 2);
            filepath = `./templates/${key}.html`;
            if ( fs.existsSync ( filepath ) )
            {
                current = 0;
                let data = fs.readFileSync ( filepath ).toString ( );
                buffer = buffer.replace ( new RegExp ( `{{${key}}}`, 'g' ), data );
            }
        }

        // Variables
        for ( let key in data )
            buffer = buffer.replace ( new RegExp ( `{{${key}}}`, 'g' ), data [key] );

        response.write ( buffer );
    }
}

function redirectRequest ( request, response, url )
{
    response.writeHead ( 302, {
        'Location': url
    } );

    response.end ( );
}

function registerRequestHandler ( path, handler )
{
    if ( typeof path !== "string" ) return false;
    if ( typeof handler !== "function" ) return false;

    if ( !requestHandlers [path] )
    {
        logger.log ( '[Info/WebServer] Registered request handler for ' + path );

        requestHandlers [path] = handler;
        return true;
    }

    return false;
}

function getRequestData ( request )
{
    let requestData = { };
    let urlObject = url.parse ( request.url, true );

    requestData.path = urlObject.pathname;
    requestData.query = urlObject.query;
    requestData.ip = request.connection.remoteAddress;

    return requestData;
}

function getMimeType ( filepath )
{
    let defaultMimeType = 'application/octet-stream';
    let extension = path.extname ( filepath ).substring ( 1, this.length );

    if ( mimeTypes [extension] ) return mimeTypes [extension];
    else return defaultMimeType;
}

function createDefaultResponse ( request, response, requestData )
{
    let fullPath = './frontend' + requestData.path;
    fullPath = fullPath.replace( /\.\.\//g, '' );

    if ( fs.existsSync ( fullPath ) && fs.lstatSync ( fullPath ).isDirectory ( ) )
        fullPath = fullPath + 'index.html';

    if ( fs.existsSync ( fullPath ) )
    {
        let mimeType = getMimeType ( fullPath );
        let stat = fs.statSync ( fullPath );

        response.writeHead ( 200,
        {
            'Content-Type': mimeType,
            'Content-Length': stat.size
        } );

        let readStream = fs.createReadStream ( fullPath )
        readStream.pipe ( response );
    }
    else
    {
        logger.log ( '[Info/WebServer] Outgoing Rsponse 404. File: ' + fullPath );

        // display error page
        response.writeHead ( 404, { 'Content-Type': 'text/html' } );
        response.write ( '<h1>Not Found</h1>' );
        response.end ( );
    }
}

let sessions = { };

function terminateSession ( sessionID )
{
    logger.log ( '[Info/WebServer] Terminating session ' + sessionID );
    delete sessions [sessionID];
}

function renewSession ( sessionID, cookies )
{
    logger.log ( '[Info/WebServer] Renewing session ' + sessionID );

    clearTimeout ( sessions [sessionID].timeout );

    sessions [sessionID].timeout = setTimeout ( function ( ) { terminateSession ( sessionID ); }, Config.session_duration );
    sessions [sessionID].expires = Date.now ( ) + Config.session_duration;

    cookies.set ( 'session_id', sessionID, { expires: new Date ( sessions [sessionID].expires ) } );
}

function getRequestSession ( request, requestData, cookies )
{
    let sessionID = cookies.get ( 'session_id' );

    if ( sessionID )
    {
        if ( sessions [sessionID] )
        {
            renewSession ( sessionID, cookies );
            return sessions [sessionID];
        }
    }

    sessionID = crypto.randomBytes ( 12 ).toString ( 'base64' );
    let newSession = { };

    newSession.id = sessionID;
    newSession.started = Date.now ( );
    newSession.expires = newSession.started + Config.session_duration;
    newSession.timeout = setTimeout ( function ( ) { terminateSession ( sessionID ); }, Config.session_duration );

    newSession.variables = { };
    cookies.set ( 'session_id', sessionID, { expires: new Date ( newSession.expires ) } );

    sessions [sessionID] = newSession;

    logger.log ( '[Info/WebServer] Starting new session ' + sessionID );
    return sessions [sessionID];
}

const server = https.createServer ( options, function ( request, response )
{
    let requestData = getRequestData ( request );
    let cookies = Cookies ( request, response );
    let session = getRequestSession ( request, response, cookies );

    logger.log ( '[Info/WebServer] Incoming Request ' + requestData.path + ' from ' + requestData.ip );

    if ( requestHandlers [requestData.path] )
    {
        try
        {
            requestHandlers [requestData.path] ( request, response, requestData, cookies, session );
        }
        catch ( error )
        {
            logger.log ( '[Info/WebServer] Outgoing Rsponse 500' );
            logger.error ( error );

            // display error page
            response.writeHead ( 500, { 'Content-Type': 'text/html' } );
            response.write ( '<h1>Internal Server Error</h1>' );
            response.end ( );
        }
    }
    else
    {
        createDefaultResponse ( request, response, requestData );
    }
} );

module.exports.registerRequestHandler = registerRequestHandler;
module.exports.redirect = redirectRequest;
module.exports.renderTemplate = renderTemplate;
module.exports.getMimeType = getMimeType;

require ( './handlers.js' );

function runMusicBot ( )
{
    try
    {
        MusicBot.run ( );
    }
    catch ( error )
    {
        logger.error ( error );
        setTimeout ( function ( ) { runMusicBot ( ); }, 500 );
    }
}

server.listen ( 3000 );
runMusicBot ( );
