import React from 'react';

import Card from '../cards/Card';

const renderCards = (cards) => {
  return cards.map((card, index) => {
    const cardData = {...card, animationDelay: 0}
    return <Card key={index} cardData={cardData} />
  })
}
const ShowdownPlayer = (props) => {
  const {
    name,
    avatarURL,
    cards
  } = props;
  return (
    <div className="player-entity--container">
      <div className="player-avatar--container">
        <img 
            className="player-avatar--image" 
            src={avatarURL}  
            alt="Player Avatar"
        />
        <h5 className="player-info--name">
            {`${name}`}
        </h5>
      </div>
      <div class="showdownPlayer--privateCards">
        <h5 class="showdownPlayer--cards--heading">
          Private Cards
        </h5>
        <div class="showdownPlayer--cards">
          { renderCards(cards) }
        </div>    
      </div>
    </div>
  )
}

export default ShowdownPlayer;