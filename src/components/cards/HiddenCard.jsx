import React from 'react';

const HiddenCard = (props) => {
  const { 
    cardData: {
      suit,
      cardFace,
      animationDelay
    },
    applyFoldedClassname
  } = props;
  return(
    <div 
      key={`${suit} ${cardFace}`} 
      className={`playing-card cardIn robotcard${(applyFoldedClassname ? ' folded' : '')}`} 
      style={{animationDelay: `${(applyFoldedClassname) ?  0 : animationDelay}ms`}}>
    </div>
  )
}

export default HiddenCard;