/*
 * script: modalbox
 * author: rekjn
 * description: frontend utility modal boxes
 */

let modalbox = 
{
    __blackout: null,
    __active: { },

    displayModal: function ( id, title, content, options )
    {
        if ( modalbox.__active.hasOwnProperty ( id ) )
            return modalbox.__active [id];

        let modal = 
        {
            title: title,
            content: content,
            options: options,
            element: modalbox.generateModal ( id, title, content, options )
        };

        modalbox.__active [id] = modal;
        return modal;
    },

    generateModal: function ( id, title, content, options )
    {
        // construct dom tree
        let modalObject = document.createElement ( 'div' );
        modalObject.classList.add ( 'modalObject' );
        modalObject.setAttribute ( 'id', id );

        let modalObjectTitle = document.createElement ( 'div' );
        modalObjectTitle.classList.add ( 'modalObjectTitle' );
        modalObjectTitle.innerHTML = title;

        let modalObjectCloseButton = document.createElement ( 'a' );
        modalObjectCloseButton.classList.add ( 'modalObjectClose' );
        modalObjectTitle.appendChild ( modalObjectCloseButton );

        modalObjectCloseButton.addEventListener ( 'click', function ( ev ) 
        {
            modalbox.closeModal ( this );
        } );

        let modalObjectContent = document.createElement ( 'div' );
        modalObjectContent.classList.add ( 'modalObjectContent' );
        modalObjectContent.innerHTML = content;

        let modalObjectOptions = document.createElement ( 'div' );
        modalObjectOptions.classList.add ( 'modalObjectOptions' );

        modalbox.generateModalOptions ( id, options, modalObjectOptions );

        modalObject.appendChild ( modalObjectTitle );
        modalObject.appendChild ( modalObjectContent );
        modalObject.appendChild ( modalObjectOptions );

        let blackout = modalbox.getBlackout ( );
        blackout.appendChild ( modalObject );

        return modalObject;
    },

    generateModalOptions: function ( modal_id, options, wrapper )
    {
        if ( !Array.isArray ( options ) )  
            throw new Error ( 'invalid type passed as option array' );

        options.forEach ( function ( value, index )
        {
            if ( typeof value !== 'object' ) 
                throw new Error ( 'invalid option format' );

            let id = modal_id + '__' + index;
            if ( value.id ) id = value.id;

            let styleClasses = 'modalOption';
            if ( value.additionalClasses ) styleClasses += ' ' + value.additionalClasses;

            let optionObject = document.createElement ( 'a' );
            optionObject.setAttribute ( 'id', id );
            optionObject.setAttribute ( 'class', styleClasses );
            optionObject.innerHTML = value.message;

            if ( typeof value.handler !== 'function' ) 
                throw new Error ( 'invalid option handler format' );

            optionObject.addEventListener ( 'click', value.handler );
            wrapper.appendChild ( optionObject );
        } );
    },

    getBlackout: function ( )
    {
        if ( modalbox.__blackout ) return modalbox.__blackout;

        let blackout = document.createElement ( 'div' );
        blackout.setAttribute ( 'id', 'modalBlackout' );
        blackout.classList.add ( 'modalBlackout' );

        document.querySelector ( 'body' ).appendChild ( blackout );

        modalbox.__blackout = blackout;
        return modalbox.__blackout;
    },

    closeModal: function ( object )
    {
        let modalObject = object.closest ( '.modalObject' );
        let id = modalObject.getAttribute ( 'id' );

        modalObject.remove ( );
        delete modalbox.__active [id];

        if ( Object.keys ( modalbox.__active ).length === 0 )
        {
            modalbox.__blackout.remove ( );
            modalbox.__blackout = null;
        }
    }
};