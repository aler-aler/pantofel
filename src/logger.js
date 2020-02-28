const fs = require ( 'fs' );
const util = require ( 'util' );

let logFile = null;

function initialize ( )
{
    let date = new Date ( );
    let name = `${date.getFullYear ( )}-${date.getMonth ( ) + 1}-${date.getDate ( )}_${date.getHours ( )}h${date.getMinutes ( )}m${date.getSeconds ( )}s`;

    name = `./logs/${name}.log.txt`;

    logFile = fs.createWriteStream ( name, { flags: 'w' } );
}

function logInternal ( message, prefix, color )
{
    let date = new Date ( );
    let timestamp = date.toLocaleTimeString();

    let whiteMessage = `[${timestamp}][${prefix}] ${message}`;
    let colorMessage = `${color}[${timestamp}][${prefix}] \x1b[0m${message}`;

    console.log ( colorMessage );
    logFile.write ( whiteMessage + '\n' );
}

function log ( prefix, message )
{
    logInternal ( message, `INFO/${prefix}`, '\x1b[0m' );
}

function warn ( prefix, message )
{
    logInternal ( message, `WARN/${prefix}`, '\x1b[33m' );
}

function error ( prefix, message )
{
    logInternal ( message, `ERROR/${prefix}`, '\x1b[31m' );
}

module.exports.initialize = initialize;
module.exports.log = log;
module.exports.warn = warn;
module.exports.error = error;
