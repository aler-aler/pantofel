const cluster = require ( 'cluster' );

if ( cluster.isMaster )
{
    cluster.fork ( );

    cluster.on ( 'exit', function ( worker, code, signal ) 
    {
        console.log ( 'Cluster', 'Restarting process after unhandled exception (in 8.5 seconds)' );
        setTimeout ( function ( ) 
        { 
            console.log ( 'Cluster', 'Process restarted' );
            cluster.fork ( ); 
        }, 8500 );
    } );
}
else
{
    require ( './index.js' );
}
