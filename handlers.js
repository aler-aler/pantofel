const requestlib = require ( 'request' );
const formidable = require ( 'formidable' );
const util = require ( 'util' );

const Config = require ( './config.json' );
const WebServer = require ( './index.js' );

const fileutil = require ( './fileutil.js' );
const logger = require ( './logger.js' );

function verifyUserCredentials ( access_token, token_type, success, failure )
{
    requestlib.get ( {
        url: 'https://discordapp.com/api/users/@me',
        headers: { authorization: token_type + ' ' + access_token }
    }, function ( error, res, body )
    {
        if ( !error ) 
        {
            success ( JSON.parse ( body ) );
        }
        else failure ( error );
    } );
}

function displayApiError ( request, response, code, message )
{
    response.writeHead ( code, { 'Content-Type': 'application/json' } );
    response.write ( JSON.stringify ( { success: false, message: message } ) );
    response.end ( );
}

WebServer.registerRequestHandler ( '/process', function ( request, response, requestData, cookies, session )
{
    if ( request.method.toLowerCase ( ) == 'post' )
    {
        if ( !session.variables.discordAuth && Config.auth_required )
        {
            displayApiError ( request, response, 403, 'authentication required' );
            return;
        }

        let form = new formidable.IncomingForm ( );
        form.uploadDir = './uploads';
        form.maxFileSize = 10 * 1024 * 1024;

        form.parse ( request, function ( error, fields, files )
        {
            if ( error ) return displayApiError ( request, response, 400, 'invalid request' );

            if ( !files.song )
            {
                response.writeHead ( 400, { 'Content-Type': 'application/json' } );
                response.write ( JSON.stringify ( { success: false, message: 'no files uploaded' } ) );
                response.end ( );

                return;
            }

            let path = files.song.path;
            fileutil.handleUploadedFile ( path, function ( )
            {
                // success
                response.writeHead ( 200, { 'Content-Type': 'application/json' } );
                response.write ( JSON.stringify ( { success: true, message: 'upload complete' } ) );
                response.end ( );
            }, function ( )
            {
                return displayApiError ( request, response, 400, 'invalid file format' );
            } );
        } );
    }
    else displayApiError ( request, response, 405, 'method not allowed' );
} );

WebServer.registerRequestHandler ( '/upload', function ( request, response, requestData, cookies, session ) 
{
    if ( session.variables.discordAuth )
    {
        response.writeHead ( 200, { 'Content-Type': 'text/html' } );
        let userdata = session.variables.discordAuth.userdata;

        WebServer.renderTemplate ( 'uploadform', request, response, 
        {  
            username: userdata.username,
            useravatar: 'https://cdn.discordapp.com/avatars/' + userdata.id + '/' + userdata.avatar + '.png',
            discriminator: userdata.discriminator
        } );

        response.end ( );
    }
    else
    {
        return WebServer.redirect ( request, response, '/' );
    }
} );

WebServer.registerRequestHandler ( '/auth', function ( request, response, requestData, cookies, session )
{
    if ( session.variables.discordAuth ) return WebServer.redirect ( request, response, '/upload' );

    if ( requestData.query && requestData.query.code && !session.variables.discordAuth )
    {
        let code = requestData.query.code;

        requestlib.post ( { 
            url: 'https://discordapp.com/api/oauth2/token',
            form: 
            {  
                client_id: Config.client_id,
                client_secret: Config.client_secret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: Config.discord_auth.redirect_uri,
                scope: 'identify'
            }
        }, function ( error, res, body )
        {
            if ( !error )
            {
                let json = JSON.parse ( body );

                if ( json.access_token )
                {
                    // return WebServer.redirect ( request, response, 'https://localhost:3000/upload' );
                    verifyUserCredentials ( json.access_token, json.token_type, function ( userdata )
                    {
                        logger.log ( '[Info/WebServer] Authenticated discord user ' + userdata.id );

                        session.variables.discordAuth = { };
                        session.variables.discordAuth.data = json;
                        session.variables.discordAuth.userdata = userdata;

                        return WebServer.redirect ( request, response, 'upload' );
                    }, function ( )
                    {
                        response.writeHead ( 200, { 'Content-Type': 'text/html' } );
                        response.write ( '<h1>Auth Failed</h1>' );
                        response.end ( );
                    } );
                }
                else return WebServer.redirect ( request, response, '/' );             
            }
            else throw new Error ( error );
        } );
    }
    else
    {
        logger.log ( '[Info/WebServer] Invalid Auth, no code provided. Redirecting...' );
        return WebServer.redirect ( request, response, Config.discord_auth.redirect );
    }
} );

WebServer.registerRequestHandler ( '/template_test', function ( request, response, requestData, cookies, session )
{
    response.writeHead ( 200, { 'Content-Type': 'text/html' } );

    WebServer.renderTemplate ( 'uploadform', request, response, 
    {  
        username: 'huj',
        useravatar: 'https://cdn.discordapp.com/avatars/276791868141076480/4a3736a3aa445bec61dde599040d0ec7.png',
        discriminator: '6969'
    } );

    response.end ( );
} );

WebServer.registerRequestHandler ( '/session_test', function ( request, response, requestData, cookies, session )
{
    if ( !session.variables.testRandomNumber ) session.variables.testRandomNumber = Math.floor ( Math.random ( ) * 2000 );

    response.writeHead ( 200, { 'Content-Type': 'text/html' } );
    response.write ( '<h1>Session Data</h1>' );
    response.write ( '<p>Session ID: ' + session.id + '</p>' );
    response.write ( '<p>Session Started: ' + session.started + '</p>' );
    response.write ( '<p>Session Expires: ' + session.expires + '</p>' );
    response.write ( '<p>Lifetime Remaining: ' + ( session.expires - Date.now ( ) ) + '</p>' );
    response.write ( '<p>Secret Number: ' + session.variables.testRandomNumber + '</p>' );
    response.write ( '<p>Variables: ' + JSON.stringify ( session.variables ) + '</p>' )
	response.end ( );
} );