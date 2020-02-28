const fs = require ( 'fs' );
const util = require ( 'util' );

let logFile = null;

function initialize ( )
{
    let date = new Date ( );
    let name = date.getFullYear ( ) + "_" + date.getMonth ( ) + "_" + date.getDay ( ) + "_" + date.getHours ( ) + "_" + date.getMinutes ( ) + "_r" + Math.floor ( Math.random ( ) * 1000 );

    name = './logs/' + name + '.log.txt';

    logFile = fs.createWriteStream ( name, { flags: 'w' } );
}

function logInternal ( message, prefix )
{
    let date = new Date ( );
    let timestamp = date.getHours ( ) + ':' + date.getMinutes ( ) + ':' + date.getSeconds ( ) + ' ' + date.getDay ( ) + '/' + date.getMonth ( );

    message = '[' + timestamp + '][' + prefix + ']' + message;

    console.log ( message );
    logFile.write ( message + '\n' );
}

function log ( message )
{
    logInternal ( message, 'INFO' );
}

function warn ( message )
{
    logInternal ( message, 'WARN' );
}

function error ( message )
{
    logInternal ( message, 'ERROR' );
}

module.exports.initialize = initialize;
module.exports.log = log;
module.exports.warn = warn;
module.exports.error = error;
