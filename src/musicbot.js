const Discord = require ( 'discord.js' );
const Client = new Discord.Client ( );

const logger = require ( './logger.js' );

const Config = require ( '../config.json' );
const fs = require ( 'fs' );

let commands = { };
let guildID = null;

function registerCommand ( command, handler )
{
    if ( typeof command !== "string" ) return;
    if ( typeof handler !== "function" ) return;
    if ( !commands [command] ) commands [command] = handler;
}

module.exports.registerCommand = registerCommand;

const MusicPlayer = require ( './musicplayer.js' );

Client.on ( 'ready', ( ) =>
{
    // client is ready
    logger.log ( 'Client', 'Logged in!' );
    Client.user.setActivity ( 'weeb shit', { type: 'LISTENING' } );

    guildID = Client.channels.cache.get ( Config.channel_id ).guild.id;

    MusicPlayer.init ( Client );
} );

Client.on ( 'warning', function ( m ) { logger.warn ( 'Client', m ); } )
    .on ( 'error', function ( m ) { logger.error ( 'Client', m ); } )

    .on ( 'disconnect', ( ) => {
        logger.warn ( 'Client', 'disconnected!' );
    } );

function formatResponse ( text )
{
    if ( typeof text === 'string' )
        return text.replace( /`/g, "`" + String.fromCharCode ( 8203 ) ).replace ( /@/g, "@" + String.fromCharCode ( 8203 ) );
    else
        return text;
}

registerCommand ( 'eval', function ( message, args, raw )
{
    if ( Config.owners.indexOf ( message.author.id ) === -1 ) return;

    if ( args.length < 2 )
    {
        message.channel.send ( "Wymagany jeden argument: kod do wykonania (tekst)" );
        return;
    }

    try
    {
        let payload = raw.substring ( 6, message.content.length );
        let output = true;
        let result = eval ( payload );

        if ( output )
            message.channel.send ( formatResponse ( result ), { code: 'xl' } );
    }
    catch ( error )
    {
        message.channel.send ( '```' + formatResponse ( error ) + '```' );
    }

    return;
} );

Client.on ( 'message', ( message ) =>
{
    if ( !message.guild ) return;
    if ( message.guild.id !== guildID ) return;
    if ( !message.content.startsWith ( Config.prefix ) ) return;

    // command parser
    let args = [], parsingString = false;
    for ( let i = 0, arg = 0; i < message.content.length; ++i )
    {
        if ( message.content [i] == ' ' && !parsingString ) arg++;
        else if ( message.content [i] == '"' ) parsingString = !parsingString;
        else
        {
            if ( !args [arg] ) args [arg] = message.content [i];
            else args [arg] += message.content [i];
        }
    }

    if ( args.length <= 0 ) return; // that one is probably impossible to reach?

    let command = args [0];
    command = command.substring ( 1, command.length );

    if ( command.length <= 0 ) return;
    else if ( commands [command] ) commands [command] ( message, args, message.content );
} );

Client.on ( 'disconnect', function ( )
{
    logger.error ( 'MusicBot', 'Disconnected. Will try to reconnect soon (10 seconds)' );

    setTimeout ( function ( )
    {
        logger.log ( 'MusicBot', 'Reconnecting' );
        Client.login ( Config.token );
    }, 10000 );
} );

module.exports.run = function ( )
{
    logger.log ( 'MusicBot', 'Initializing bot account' );
    Client.login ( Config.token );
}
