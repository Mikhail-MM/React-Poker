import React from 'react';
import { 
  renderUnicodeSuitSymbol 
} from '../../utils/ui';

const Card = (props) => {
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
      className={`playing-card cardIn ${(applyFoldedClassname ? ' folded' : '')}`} 
      style={{animationDelay: `${(applyFoldedClassname) ?  0 : animationDelay}ms`}}>
      <h6
        style={{color: `${(suit === 'Diamond' || suit === 'Heart') ? 'red' : 'black'}`}}>
        {`${cardFace} ${renderUnicodeSuitSymbol(suit)}`}
      </h6>
    </div>
  )
}

export default Card;