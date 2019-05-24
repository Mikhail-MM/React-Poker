import React from 'react';

import Card from '../cards/Card';
import HiddenCard from '../cards/HiddenCard';

import PlayerStatusNotificationBox from "./PlayerStatusNotificationBox";

const dealerChipImageURL = "/assets/chip.svg";
const chipCountImageURL = "./assets/chips.svg";
const playerBetImageURL = "./assets/bet.svg";

const Player = (props) => {
  const {
    arrayIndex,
    playerAnimationSwitchboard,
    endTransition,
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
          <img src={dealerChipImageURL} alt="Dealer Chip"/>
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
      return cards.map((card, index)=> {
        if (phase !== 'showdown') {
          return(
            <HiddenCard key={index} cardData={card} applyFoldedClassname={applyFoldedClassname}/>
          );
        } else {
          // Reset Animation Delay
          const cardData = {...card, animationDelay: 0}
          return(
            <Card key={index} cardData={cardData} applyFoldedClassname={applyFoldedClassname}/>
          );
        }
      });
    }
    else {
      return cards.map((card, index) => {
        return(
          <Card key={index} cardData={card} applyFoldedClassname={applyFoldedClassname}/>
        );
      });
    }
  }

  const ifAnimating = (playerBoxIndex) => { 
    if (playerAnimationSwitchboard[playerBoxIndex].isAnimating) {
      return true;
    } else {
      return false;
    }
  }

  return (
    <div className={`player-entity--wrapper p${arrayIndex}`}>
      <PlayerStatusNotificationBox
        index={arrayIndex}
        isActive={ifAnimating(arrayIndex)}
        content={playerAnimationSwitchboard[arrayIndex].content}
        endTransition={endTransition}
      />
      <div className='centered-flex-row abscard'>
        { renderPlayerCards() }
      </div>
      <div className="player-entity--container">
        <div className="player-avatar--container">
          <img 
            className={`player-avatar--image${(isActive ? ' activePlayer' : '')}`} 
            src={avatarURL} 
            alt="Player Avatar" 
          />
          <h5 className="player-info--name" style={{'fontSize': (name.length < 14) ? 12 : 10}}>
            {`${name}`}
          </h5>
          <div className="player-info--stash--container">
            <img className="player-info--stash--image" src={chipCountImageURL} alt="Player Stash"/>
            <h5>{`${chips}`}</h5>
          </div>
          <div className="player-info--bet--container">
            <img className="player-info--bet--image" src={playerBetImageURL} alt="Player Bet" />
            <h5>{`Bet: ${bet}`}</h5>
          </div>
          { renderDealerChip() }
        </div>
      </div>
    </div>
  )
}

export default Player;