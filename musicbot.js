const Discord = require ( 'discord.js' );
const Client = new Discord.Client ( );

const logger = require ( './logger.js' );

const Config = require ( './config.json' );
const fs = require ( 'fs' );

let isVoiceChannel = false;
let dispatcher = undefined;
let voteSkips = 0;
let voteSkipped = { };
let globalVoiceChannel = null;

let songs = [];
let songQueue = [];

function shuffleArray ( array )
{
	let newArray = Array.from ( array );
	let remaining = newArray.length, index, temp;
	
	while ( remaining > 0 )
	{
		index = Math.floor ( ( Math.random ( ) * remaining ) );
		remaining = remaining - 1;
		
		temp = newArray [remaining];
		newArray [remaining] = newArray [index];
		newArray [index] = temp;
	}
	
	return newArray;
}

function musicQueueRandomize ( )
{
	logger.log ( '[Info/automusic] a new song queue will now be randomized!' );
	songQueue = shuffleArray ( songs );
}

function musicQueueInsert ( song )
{
	logger.log ( '[Info/automusic] added song to queue: ' + song );
	songQueue.push ( song );
}

function musicQueuePop ( )
{
	return songQueue.pop ( );
}

function getNextSong ( )
{
	if ( songQueue.length > 0 ) return musicQueuePop ( );
	else
	{
		generateSongList ( );
		musicQueueRandomize ( );

		return musicQueuePop ( );
	}
}

function generateSongList ( )
{
	songs = [ ];

	fs.readdirSync ( './playlist' ).forEach ( function ( file )
	{
		songs.push ( file );
	} );
}

function musicQueueGet ( )
{
	return Array.from ( songQueue );
}

function playMusic ( )
{
	let song = getNextSong ( );

	logger.log ( '[Sound/automusic] now playing: ' + song );

	let voiceChannel = Client.channels.get ( Config.channel_id );
	globalVoiceChannel = voiceChannel;
	
	if ( voiceChannel instanceof Discord.VoiceChannel )
	{
		voiceChannel.join ( ).then ( ( connection ) =>
		{
			connection.on ( 'disconnect', function ( )
			{
				logger.log ( '[Info/automusic] disconnected from channel, will reconnect soon' );

				setTimeout ( function ( )
				{
					logger.log ( '[Info/automusic] reconnecting' );
					playMusic ( );
				}, 3000 );
			} );

			globalConnection = connection;
			
			dispatcher = connection.play ( './playlist/' + song, { passes: 3 } );
			dispatcher.on ( 'error', function ( m ) { logger.error ( m ); } );
			
			dispatcher.on ( 'end', ( ) => 
			{
				setTimeout ( function ( )
				{
					let announcer = connection.play ( './announcer.mp3', { passes: 3 } );
					announcer.on ( 'error', function ( m ) { logger.error ( m ); } );

					logger.log ( '[Info/automusic] playing announcer' );

					announcer.on ( 'end', ( ) => 
					{
						voteSkips = 0;
						voteSkipped = { };

						logger.log ( '[Info/automusic] song concluded, playing another random song' );
						setTimeout ( function ( ) { playMusic ( ); }, 500 );
					} );
				}, 1000 );
			} );
		} )
		.catch ( ( error ) => {
			logger.log ( '[Error/automusic] cannot join voice channel' );
			logger.log ( error );
		} );
	}
	else
	{
		logger.log ( '[Info/automusic] WARNING! ' + Config.channel_id + ' is not a valid voice channel id!' );
	}
}

Client.on ( 'ready', ( ) => 
{
	// client is ready
	logger.log ( '[Info/automusic] logged in!' );
	Client.user.setActivity ( 'weeb shit', { type: 'LISTENING' } );
	
	playMusic ( );
} );

Client.on ( 'warning', function ( m ) { logger.warn ( m ); } )
    .on ( 'error', function ( m ) { logger.error ( m ); } )

    .on ( 'disconnect', ( ) => {
        logger.warn ( '[Info/automusic] disconnected!' );
    } );

function formatResponse ( text )
{
    if ( typeof text === 'string' )
        return text.replace( /`/g, "`" + String.fromCharCode ( 8203 ) ).replace ( /@/g, "@" + String.fromCharCode ( 8203 ) );
    else
        return text;
}

Client.on ( 'message', ( message ) => 
{
	// maintenance
	if ( message.content.startsWith ( '$voteskip' ) )
	{
		let userid = message.author.id;
		let onlineusers = globalVoiceChannel.members.size;
		let required = Math.floor ( ( onlineusers - 1 ) / 2 );

		if ( !voteSkipped [userid] )
		{
			voteSkips++;
			message.channel.send ( "Zarejestrowano twój glos **" + voteSkips + "/" + ( required + 1 ) + "**" );

			voteSkipped [userid] = true;

			if ( voteSkips > Math.floor ( ( onlineusers - 1 ) / 2 ) )
			{
				message.channel.send ( "Głosem większości dostępnych piosenka została pominięta." );
				dispatcher.end ( );
			}
		}
        else
        {
            message.channel.send ( "Twój głos był już zarejestrowany." );
        }
	}
    
    else if ( message.content.startsWith ( '$cancelvote' ) )
    {
		let userid = message.author.id;
		let onlineusers = globalVoiceChannel.members.size;
		let required = Math.floor ( ( onlineusers - 1 ) / 2 );

		if ( voteSkipped [userid] )
		{
			voteSkips--;
			message.channel.send ( "Wycofano twój głos **" + voteSkips + "/" + ( required + 1 ) + "**" );
			voteSkipped [userid] = true;
		}
        else
        {
            message.channel.send ( "Nie głosowałeś za pominięciem tej piosenki." );
        }
    }
	
    else if ( message.content.startsWith ( '$lock' ) )
    {
	    message.channel.send ( "Nie będę wyłączał tej chujowej piosenki z demokratycznego głosowania." ); 
    }

	else if ( message.content.startsWith ( '$skip' ) && message.member.hasPermission( 'KICK_MEMBERS' ) )
	{
		dispatcher.end ( );
		return;
	}

	else if ( message.content.startsWith ( '$eval ' ) && message.author.id === '276791868141076480' )
	{
		try
		{
			let payload = message.content.substring ( 6, message.content.length );
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
	}
} );

Client.on ( 'disconnect', function ( )
{
	logger.error ( '[Error/musicbot] disconnected. bot will try to reconnect soon (10 seconds)' );

	setTimeout ( function ( )
	{
		logger.log ( '[Info/musicbot] reconnecting' );
		Client.login ( Config.token );
	}, 10000 );
} );

module.exports.run = function ( )
{
	logger.log ( '[Info/musicbot] initializing bot account' );
	Client.login ( Config.token );
}

module.exports.musicQueueInsert = musicQueueInsert;
module.exports.musicQueuePop = musicQueuePop;
module.exports.musicQueueRandomize = musicQueueRandomize;
module.exports.musicQueueGet = musicQueueGet;
