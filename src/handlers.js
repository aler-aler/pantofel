const requestlib = require ( 'request' );
const formidable = require ( 'formidable' );
const fs = require ( 'fs' );

const Config = require ( '../config.json' );
const WebServer = require ( './index.js' );

const Database = require ( './database.js' );

const fileutil = require ( './fileutil.js' );
const logger = require ( './logger.js' );

const MusicPlayer = require ( './musicplayer.js' );

const genres = require( '../genres.json' );

const FileReader = require ( 'filereader' );

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

WebServer.registerRequestHandler ( '/songlist', function ( request, response, requestData, cookies, session )
{
    if ( session.variables.discordAuth )
    {
        let allsongs = '';

        Database.getFilenames( ).forEach ( function ( key )
        {
            let tags = Database.getTags ( key );
            allsongs += `<tr><td><a class="ext-audiobutton" data-state="play" title="Play/Pause"><audio class="ext-audiobutton" data-volume="1.0" hidden="" preload="none"><source src="/songpreview?title=${key}" type="audio/mp3"></audio></a></td>`;
            allsongs += `<td><a href="/song?title=${ key }">${ key }</a></td>`
            allsongs += `<td>${ tags.artist }</td>`;
            allsongs += `<td>${ tags.title }</td>`;
            allsongs += `<td>${ tags.album }</td>`;
            allsongs += `<td>${ tags.genrename }</td></tr>`;
        } );

        response.writeHead ( 200, { 'Content-Type': 'text/html' } );
        WebServer.renderTemplate ( 'songlist', request, response,
        {
            allsongs: allsongs
        } );
        response.end ( );
    }
    else
    {
        cookies.set ( 'recent_target', `/songlist`, { expires: new Date ( Date.now ( ) + 5 * 60 * 1000 ) } );
        WebServer.redirect ( request, response, '/' );
    }
} );

WebServer.registerRequestHandler ( '/', function ( request, response, requestData, cookies, session )
{
    response.writeHead ( 200, { 'Content-Type': 'text/html' } );
    if ( session.variables.discordAuth )
    {
        let userdata = session.variables.discordAuth.userdata;

        WebServer.renderTemplate ( 'index-logged', request, response,
        {
            username: userdata.username,
            useravatar: `https://cdn.discordapp.com/avatars/${userdata.id}/${userdata.avatar}.png`,
            discriminator: userdata.discriminator
        } );
    }
    else
    {
        WebServer.renderTemplate ( 'index', request, response, {} );
    }
    response.end ( );
} );

WebServer.registerRequestHandler ( '/songpreview', function ( request, response, requestData, cookies, session )
{
    if ( requestData.query && requestData.query.title )
    {
        let filename = new String ( requestData.query.title );
        let fullPath = './playlist/' + filename;

        fullPath = fullPath.replace( /\.\.\//g, '' );

        if ( fs.existsSync ( fullPath ) )
        {
            let stat = fs.statSync ( fullPath );

            response.writeHead ( 200,
            {
                'Content-Type': 'audio/mpeg',
                'Content-Length': stat.size
            } );

            let readStream = fs.createReadStream ( fullPath )
            readStream.pipe ( response );
        }
        else
        {
            response.writeHead ( 200, { 'Content-Type': 'application/json' } );
            response.write ( JSON.stringify ( { 'error': true, 'message': 'not found' } ) );
            response.end ( );
        }
    }
    else
    {
        WebServer.redirect ( request, response, '/' );
    }
} );

WebServer.registerRequestHandler ( '/cover', function ( request, response, requestData, cookies, session )
{
    if ( requestData.query && requestData.query.title )
    {
        let filename = new String ( requestData.query.title );
        let tags = new Database.getTags ( filename );
        if ( tags && tags.image )
        {
            response.writeHead ( 200,
            {
                'Content-Type': `image/${tags.mime}`,
                'Content-Length': tags.image.length
            } );
            response.write ( tags.image );
            response.end ( );
        }
        else
        {
            response.writeHead ( 200, { 'Content-Type': 'application/json' } );
            response.write ( JSON.stringify ( { 'error': true, 'message': 'not found' } ) );
            response.end ( );
        }
    }
    else
    {
        WebServer.redirect ( request, response, '/' );
    }
} );

WebServer.registerRequestHandler ( '/id3', function ( request, response, requestData, cookies, session )
{
    if ( request.method.toLowerCase ( ) == 'post' )
    {
        if ( !session.variables.discordAuth && Config.auth_required )
        {
            displayApiError ( request, response, 403, 'authentication required' );
            return;
        }

        let form = new formidable.IncomingForm ( );

        form.parse ( request, function ( error, fields, files )
        {
            let songname = fields.songname;
            fields.songname = null;
            
            Database.setArtist ( songname, fields.artist );
            Database.setTitle ( songname, fields.title );
            Database.setAlbum ( songname, fields.album );
            Database.setGenre ( songname, fields.genre );
            
            function reply ( ) 
            {
                if ( Database.write ( songname ) )
                {
                    if ( session.variables.discordAuth )
                        logger.log ( 'WebServer', `User ${session.variables.discordAuth.userdata.username} has updated ${songname}.` );
                    response.writeHead ( 200, { 'Content-Type': 'application/json' } );
                    response.write ( JSON.stringify ( { success: true, message: 'upload complete' } ) );
                    response.end ( );
                }
                else
                {
                    response.writeHead ( 400, { 'Content-Type': 'application/json' } );
                    response.write ( JSON.stringify ( { success: false, message: 'fatal error' } ) );
                    response.end ( );
                }
                if ( error ) return displayApiError ( request, response, 400, 'invalid request' );
            };
            
            if ( files.image && files.image.size > 0 ) 
            {
                let fr = new FileReader ( ) ;
                fr.onerror = function onerror ( ev ) 
                {
                    response.writeHead ( 400, { 'Content-Type': 'application/json' } );
                    response.write ( JSON.stringify ( { success: false, message: 'invalid file' } ) );
                    response.end ( );
                }
                fr.onload = function onload ( ev ) 
                {
                    let buff = ev.target.result;
                    if ( buff [ 0 ] === 0xFF && buff [ 1 ] === 0xD8
                    && buff [ buff.length - 2 ] === 0xFF && buff [ buff.length - 1 ] === 0xD9 )
                    {
                        Database.setImage ( songname, buff );
                        reply ( );
                    }
                    else
                    {
                        response.writeHead ( 400, { 'Content-Type': 'application/json' } );
                        response.write ( JSON.stringify ( { success: false, message: 'file must be a jpeg' } ) );
                        response.end ( );
                    }
                }
                fr.readAsArrayBuffer ( files.image );
            } 
            else 
            {
                reply();
            }
        } );
    }
    else displayApiError ( request, response, 405, 'method not allowed' );
} );

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
            fileutil.handleUploadedFile ( path, function ( songname )
            {
                MusicPlayer.musicQueueInsert ( songname + '.mp3' );

                Database.open ( `${songname}.mp3` );
                
                logger.log ( 'WebServer', `User ${session.variables.discordAuth.userdata.username} has uploaded ${songname}.mp3.` );

                // success
                response.writeHead ( 200, { 'Content-Type': 'application/json' } );
                response.write ( JSON.stringify ( { success: true, message: 'upload complete', songname: `${songname}.mp3` } ) );
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
        cookies.set ( 'recent_target', `/upload`, { expires: new Date ( Date.now ( ) + 5 * 60 * 1000 ) } );
        return WebServer.redirect ( request, response, '/' );
    }
} );

WebServer.registerRequestHandler ( '/song', function ( request, response, requestData, cookies, session )
{
    if ( session.variables.discordAuth && requestData.query && requestData.query.title )
    {
        let filename = new String ( requestData.query.title );
        let fullPath = `./playlist/${filename}`;

        fullPath = fullPath.replace( /\.\.\//g, '' );

        if ( fs.existsSync ( fullPath ) )
        {
            let stat = fs.statSync ( fullPath );

            response.writeHead ( 200, { 'Content-Type': 'text/html' } );
            let userdata = session.variables.discordAuth.userdata;

            let tags = Database.getTags ( filename );
            let genrelist = '<option value=12">Other</option>';
            for(key in genres) {
                if ( key != "12" ) // Other był już dodany na froncie
                {
                    genrelist += `<option value="${key}"${tags.genre == key ? ' selected' : ''}>${genres[key].name}</option>`;
                }
            }
            WebServer.renderTemplate ( 'songedit', request, response,
            {
                songauthor: tags.artist ? tags.artist : '',
                songname: tags.title ? tags.title : '',
                songalbum: tags.album ? tags.album : '',
                genrelist: genrelist,
                username: userdata.username,
                useravatar: 'https://cdn.discordapp.com/avatars/' + userdata.id + '/' + userdata.avatar + '.png',
                discriminator: userdata.discriminator,
                song: requestData.query.title,
                image: `${Config.server_url}cover?title=${filename}`
            } );

            response.end();
        }
        else
        {
            WebServer.redirect ( request, response, '/' );
        }
    }
    else
    {
        cookies.set ( 'recent_target', `/song?title=${requestData.query.title}`, { expires: new Date ( Date.now ( ) + 5 * 60 * 1000 ) } );
        WebServer.redirect ( request, response, '/' );
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
                    verifyUserCredentials ( json.access_token, json.token_type, function ( userdata )
                    {
                        logger.log ( 'WebServer', `Authenticated user ${userdata.id}` );

                        session.variables.discordAuth = { };
                        session.variables.discordAuth.data = json;
                        session.variables.discordAuth.userdata = userdata;
                        
                        let target = cookies.get ( 'recent_target' ) ? cookies.get ( 'recent_target' ) : '/';        
                        cookies.set ( 'recent_target', `/`, { expires: new Date ( Date.now ( ) + 5 * 60 * 1000 ) } );

                        return WebServer.redirect ( request, response, target );
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
        logger.log ( 'WebServer', 'Invalid Auth, no code provided. Redirecting...' );
        return WebServer.redirect ( request, response, Config.discord_auth.redirect );
    }
} );

WebServer.registerRequestHandler ( '/get_asset', function ( request, response, requestData, cookies, session )
{
    let skin = './assets/default';
    let cookieSkin = cookies.get ( 'skin_id' );

    if ( !cookieSkin )
    {
        cookieSkin = Config.enabled_skins [Math.floor ( Math.random ( ) * Config.enabled_skins.length )];
        cookies.set ( 'skin_id', cookieSkin, { expires: new Date ( Date.now ( ) + 5 * 60 * 1000 ) } );

        logger.log ( 'WebServer', 'Random skin selected: ${cookieSkin}' );
    }

    cookieSkin = String ( cookieSkin );
    cookieSkin = cookieSkin.replace ( /[^a-zA-Z0-9-_]+/ig, '' );
    cookieSkin = './assets/' + cookieSkin;

    if ( cookieSkin && fs.existsSync ( cookieSkin ) && fs.lstatSync ( cookieSkin ).isDirectory ( ) )
        skin = cookieSkin;

    if ( requestData.query.name )
    {
        let resourceName = requestData.query.name.replace ( /[^a-zA-Z0-9-_\.]+/, '' );
        let fullPath = skin + '/' + resourceName;

        if ( fs.existsSync ( fullPath ) )
        {
            let mimeType = WebServer.getMimeType ( fullPath );
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
            response.writeHead ( 404, { 'Content-Type': 'text/html' } );
            response.write ( '<h1>Not Found</h1>' );
            response.end ( );
        }
    }
    else
    {
        response.writeHead ( 200, { 'Content-Type': 'text/html' } );
        response.end ( );
    }
} );