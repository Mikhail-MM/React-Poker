import React from 'react';
const dealerChipImageURL = "/assets/chip.svg";
const chipCountImageURL = "./assets/chips.svg";
const playerBetImageURL = "./assets/bet.svg";

const Player = (props) => {
  const {
    arrayIndex,
    hasDealerChip,
    isActive,
    player
  } = props;
  
  const renderDealerChip = () => {
    if (hasDealerChip) {
      return (
        <div className="dealer-chip-icon-container"> {/*TODO: Re-do Component ClassName */}
          <img src={dealerChipImageURL} />
        </div>
      )
    } else return null;
  }

  return (
    <div class={`player-entity--wrapper p${arrayIndex}`}>
      <div class="player-entity--container">
        <div class="player-avatar--container">
          <img 
            class={`player-avatar--image${(isActive ? ' activePlayer' : '')}`} 
            src={player.avatarURL}  
          />
          {() => renderDealerChip()}
        </div>
        <div class="player-info--wrapper">
          <h5 class="player-info--name">
            {`${player.name}`}
          </h5>
          <div class="player-info--stash--container">
            <img class="player-info--stash--image" src={chipCountImageURL} />
            <h5>{`${player.chips}`}</h5>
          </div>
          <div class="player-info--bet--container">
            <img class="player-info--bet--image" src={playerBetImageURL} />
            <h5>{`Bet: ${player.bet}`}</h5>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Player;