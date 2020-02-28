const cluster = require ( 'cluster' );

if ( cluster.isMaster )
{
    cluster.fork ( );

    cluster.on ( 'exit', function ( worker, code, signal ) 
    {
        console.log ( '[Info/cluster] restarting process after unhandled exception (in 8.5 seconds)' );
        setTimeout ( function ( ) 
        { 
            console.log ( '[Info/cluster] process restarted' );
            cluster.fork ( ); 
        }, 8500 );
    } );
}
else
{
    require ( './index.js' );
}
