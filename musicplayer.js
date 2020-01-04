const Discord = require ( 'discord.js' );
const logger = require ( './logger.js' );
const Config = require ( './config.json' );
const MusicBot = require ( './musicbot.js' );
const fs = require ( 'fs' );

let isVoiceChannel = false;
let dispatcher = undefined;
let voteSkips = 0;
let voteSkipped = { };
let globalVoiceChannel = null;

let currentSong = null;
let songs = [];
let songQueue = [];

let repeat = false;
let voteRepeats = 0;
let votedRepeat = { };

let forcePlay = false;
let forcePlayPath = null;

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

function getRandomAnnouncer ( )
{
	let announcerMessages = [ ];

	fs.readdirSync ( './announcer' ).forEach ( function ( file )
	{
		announcerMessages.push ( file );
	} );

	let rng = Math.floor ( Math.random ( ) * announcerMessages.length );
	return announcerMessages [rng];
}

function musicQueueGet ( )
{
	return Array.from ( songQueue );
}

function getCurrentDispatcher ( )
{
	return dispatcher;
}

function getCurrentSong ( )
{
	return currentSong;
}

function getSongList ( )
{
	generateSongList ( );
	return songs;
}

function playMusic ( Client )
{
	let song = null;

	if ( repeat ) song = currentSong;
	else song = getNextSong ( );

	repeat = false;
	voteRepeats = 0;
	votedRepeat = { };

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

			currentSong = song;
			
			dispatcher = connection.play ( './playlist/' + song, { passes: 3 } );
			dispatcher.on ( 'error', function ( m ) { logger.error ( m ); } );
			
			dispatcher.on ( 'end', ( ) => 
			{
				setTimeout ( function ( )
				{
					let announcerFile = getRandomAnnouncer ( );
					logger.log ( '[Info/automusic] selecting random announcer message: ' + announcerFile );

					let announcer = null;

					if ( forcePlay ) announcer = connection.play ( forcePlayPath, { passes: 3 } );
					else announcer = connection.play ( './announcer/' + announcerFile, { passes: 3 } );

					forcePlay = false;

					announcer.on ( 'error', function ( m ) { logger.error ( m ); } );

					logger.log ( '[Info/automusic] playing announcer' );

					announcer.on ( 'end', ( ) => 
					{
						voteSkips = 0;
						voteSkipped = { };

						logger.log ( '[Info/automusic] song concluded, playing another random song' );
						setTimeout ( function ( ) { playMusic ( Client ); }, 500 );
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

function voteSkipHandler ( message, args )
{
    if ( !message.member.voice.channel ) return;
    if ( message.member.voice.channel.id != globalVoiceChannel.id ) return;

    let userid = message.author.id;
	let onlineusers = globalVoiceChannel.members.size;
	let required = Math.floor ( ( onlineusers - 1 ) / 2 );

	if ( !voteSkipped [userid] )
	{
        if ( voteSkips > required ) return;

		voteSkips++;
		message.channel.send ( "Zarejestrowano twój glos **" + voteSkips + "/" + ( required + 1 ) + "**" );

		voteSkipped [userid] = true;

		if ( voteSkips > required )
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

MusicBot.registerCommand ( 'voteskip', voteSkipHandler );
MusicBot.registerCommand ( 'vs', voteSkipHandler );

MusicBot.registerCommand ( 'cancelvote', function ( message, args )
{
    let userid = message.author.id;
    let onlineusers = globalVoiceChannel.members.size;
    let required = Math.floor ( ( onlineusers - 1 ) / 2 );

    if ( voteSkipped [userid] )
    {
        voteSkips--;
        message.channel.send ( "Wycofano twój głos **" + voteSkips + "/" + ( required + 1 ) + "**" );
        voteSkipped [userid] = false;
    }
    else
    {
        message.channel.send ( "Nie głosowałeś za pominięciem tej piosenki." );
    }
} );

MusicBot.registerCommand ( 'lock', function ( message, args )
{
    message.channel.send ( "Nie będę wyłączał tej chujowej piosenki z demokratycznego głosowania." ); 
} );

MusicBot.registerCommand ( 'skip', function ( message, args )
{
    if ( message.member.hasPermission ( 'KICK_MEMBERS' ) )
    {
        message.channel.send ( "Użytkownik **" + message.author.username + '** pominął piosenkę!' );
		dispatcher.end ( );
    }
} );

MusicBot.registerCommand ( 'songname', function ( message, args )
{
    let download = Config.server_url + 'songpreview?title=' + currentSong;
    message.channel.send ( "Nazwa aktualnie odtwarzanego pliku mp3: **" + currentSong + '**\nAby pobrać plik udaj się tutaj: ' + download );
} );

MusicBot.registerCommand ( 'queue', function ( message, args )
{
    message.channel.send ( "W aktualnej kolejce pozostało **" + songQueue.length + '** piosenek' );
} );

MusicBot.registerCommand ( 'voterepeat', function ( message, args )
{
    if ( repeat ) return;
    if ( !message.member.voice.channel ) return;
    if ( message.member.voice.channel.id != globalVoiceChannel.id ) return;

    let userid = message.author.id;
    let onlineusers = globalVoiceChannel.members.size;
    let required = Math.floor ( ( onlineusers - 1 ) / 2 );

    if ( !votedRepeat [userid] )
    {
        if ( voteRepeats > required );

        voteRepeats++;
        message.channel.send ( "Zarejestrowano twój glos **" + voteRepeats + "/" + ( required + 1 ) + "**" );

        votedRepeat [userid] = true;

        if ( voteRepeats > required )
        {
            message.channel.send ( "Głosem większości dostępnych piosenka zostanie powtórzona." );
            repeat = true;
        }
    }
    else
    {
        message.channel.send ( "Twój głos był już zarejestrowany." );
    }
} );

MusicBot.registerCommand ( 'repeat', function ( message, args )
{
    if ( message.member.hasPermission ( 'KICK_MEMBERS' ) && !repeat )
    {
        message.channel.send ( "Użytkownik **" + message.author.username + '** zarządził powtórzenie aktualnej piosenki po jej zakończeniu!' );
		repeat = true;
    }
} );

MusicBot.registerCommand ( 'forceplay', function ( message, args )
{
	if ( Config.owners.indexOf ( message.author.id ) === -1 ) return;

	if ( args.length < 2 )
	{
		message.channel.send ( "Wymagany jeden argument: plik do odtworzenia (tekst)" );
		return;
	}

	forcePlay = true;
	forcePlayPath = args [1];
	dispatcher.end ( );

	message.channel.send ( "Wymuszone zostanie odtwarzanie pliku: **" + forcePlayPath + "**" );
} );

module.exports.playMusic = playMusic;
module.exports.musicQueueInsert = musicQueueInsert;
module.exports.musicQueuePop = musicQueuePop;
module.exports.musicQueueRandomize = musicQueueRandomize;
module.exports.musicQueueGet = musicQueueGet;
module.exports.getCurrentDispatcher = getCurrentDispatcher;
module.exports.getCurrentSong = getCurrentSong;
module.exports.getSongList = getSongList;