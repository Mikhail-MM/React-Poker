import React from 'react';
import { CSSTransition } from 'react-transition-group';

function PlayerStatusNotificationBox({index, isActive, content, endTransition}) {
    return(
        <CSSTransition 
            in={isActive} 
            timeout={{
                appear: 0,
                enter: 0,
                exit: 1250,
               }}
            classNames="transitionable-actionBox" 
            onEntered={() => endTransition(index)}
        >
            <div className="actionBox">
            {`${content}`}
            </div>
        </CSSTransition>
    )
}

export default PlayerStatusNotificationBox;