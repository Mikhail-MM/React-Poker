import React from 'react';

import Card from '../cards/Card';
import HiddenCard from '../cards/HiddenCard';

const dealerChipImageURL = "/assets/chip.svg";
const chipCountImageURL = "./assets/chips.svg";
const playerBetImageURL = "./assets/bet.svg";

const Player = (props) => {
  const {
    arrayIndex,
    hasDealerChip,
    isActive,
    phase,
    clearCards,
    player: {
      robot,
      folded,
      cards,
      avatarURL,
      name,
      chips,
      bet
    }
  } = props;

  const renderDealerChip = () => {
    if (hasDealerChip) {
      return (
        <div className="dealer-chip-icon-container">
          <img src={dealerChipImageURL} />
        </div>
      )
    } else return null;
  }

  const renderPlayerCards = () => {
    let applyFoldedClassname;

    if (folded || clearCards) {
      applyFoldedClassname = true
    }

    if (robot) {
      return cards.map(card => {
        if (phase !== 'showdown') {
          return(
            <HiddenCard cardData={card} applyFoldedClassname={applyFoldedClassname}/>
          );
        } else {
          return(
            <Card cardData={card} applyFoldedClassname={applyFoldedClassname}/>
          );
        }
      });
    }
    else {
      return cards.map(card => {
        return(
          <Card cardData={card} applyFoldedClassname={applyFoldedClassname}/>
        );
      });
    }
  }

  return (
    <div class={`player-entity--wrapper p${arrayIndex}`}>
      <div className='centered-flex-row abscard'>
        { renderPlayerCards() }
      </div>
      <div class="player-entity--container">
        <div class="player-avatar--container">
          <img 
            class={`player-avatar--image${(isActive ? ' activePlayer' : '')}`} 
            src={avatarURL}  
          />
          {() => renderDealerChip()}
        </div>
        <div class="player-info--wrapper">
          <h5 class="player-info--name">
            {`${name}`}
          </h5>
          <div class="player-info--stash--container">
            <img class="player-info--stash--image" src={chipCountImageURL} />
            <h5>{`${chips}`}</h5>
          </div>
          <div class="player-info--bet--container">
            <img class="player-info--bet--image" src={playerBetImageURL} />
            <h5>{`Bet: ${bet}`}</h5>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Player;