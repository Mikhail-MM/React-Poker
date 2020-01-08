import React from 'react';

import Card from '../cards/Card';
import HiddenCard from '../cards/HiddenCard';

import sc from 'styled-components';

const playerRenderStyles = {
  0: {
    playerShadowContainer: {
      bottom: '5%',
      top: 'unset',
      right: 'unset',
      left: '50%',
      transform: 'translateX(-50%)',
    },
    playerInfoBox: {

    },
  },
  1: {
    playerShadowContainer: {
      bottom: '30px;',
      top: 'unset',
      right: '12.5%',
      left: 'unset',
      transform: '',
    },
    playerInfoBox: {
      transform: 'translateX(-100px)',
    }
  },
  2: {
    playerShadowContainer: {
      top: '50%',
      transform: 'translateY(-50%)',
      right: '5%',
    },
    playerInfoBox: {
      transform: 'translateX(-100px)'
    }
  },
  3: {
    playerShadowContainer: {
      top: '30px',
      right: '12.5%',
    },
    playerInfoBox: {
      left: '0',
		  transform: 'translateX(-100px)',
    }
  },
  4: {
    playerShadowContainer: {
      top: '30px',
      left: '12.5%',
    },
    playerInfoBox: {},
  },
  5: {
    playerShadowContainer: {
      top: '50%',
      transform: 'translateY(-50%)',
      left: '5%',
    },
    playerInfoBox: {},
  },
  6: {
    playerShadowContainer: {
      bottom: '30px',
      left: '12.5%',
    },
    playerInfoBox: {},
  },
}


const PlayerContainer = sc.div`
  position: absolute;
  height: 50px;
  width: 50px;
  background: ${props => props.background});
  border: 0px solid white;
  border-radius: 100%;
  box-sizing: border-box;
  bottom: ${props => props.bottom};
  top: ${props => props.top};
  left: ${props => props.left};
  right: ${props => props.right};
  color: ${props => props.color};
  transform: ${props => props.transform};
`
const PlayerInfoBox = sc.div`
  display: ${props => props.arrayIndex === 0 ? 'none' : 'flex' };
  position: absolute;
  height: 50px;
  width: 150px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  background-color: rgba(0,0,0,0.25);
  flex-direction: column;
  box-sizing: border-box;
  border-radius: 15px;
  color: white;
  font-size: 12px;
  text-shadow: 1px 1px 1px black;
  bottom: ${props => props.bottom};
  top: ${props => props.top};
  left: ${props => props.left};
  right: ${props => props.right};
  color: ${props => props.color};
  transform: ${props => props.transform};
  text-align: ${props => props.arrayIndex > 3 ? 'right' : 'left'};
  padding-right: ${props => props.arrayIndex > 3 ? '0px' : '7px'};
  padding-left: ${props => props.arrayIndex < 3 ? '7px' : '0px'};
`;

const Avatar = sc.img`
  position: absolute;
  height: 100%;
  width: 100%;
  background-color: red;
  border-radius: 100%;
  top: 0;
  left: 0;
`
const CardContainer = sc.div`
display: flex;
  position: absolute;
  width: auto;
  height: 25px;
  background-color: purple; 
  z-index: 1000;
`

const PlayerNew = ({ 
  player: { cards, name, chips, bet, avatarURL, robot, folded },
  phase, 
  arrayIndex,
  clearCards, 
  cardAnimationState, 
  setCardAnimationState 
}) => {
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
  return(
    <PlayerContainer 
      key={arrayIndex}
      top={playerRenderStyles[arrayIndex].playerShadowContainer.top}
      bottom={playerRenderStyles[arrayIndex].playerShadowContainer.bottom}
      left={playerRenderStyles[arrayIndex].playerShadowContainer.left}
      right={playerRenderStyles[arrayIndex].playerShadowContainer.right}
      color={playerRenderStyles[arrayIndex].playerShadowContainer.color}
      transform={playerRenderStyles[arrayIndex].playerShadowContainer.transform}
    > 
      < Avatar src={avatarURL}/>
      <PlayerInfoBox 
        arrayIndex={arrayIndex}
        transform={playerRenderStyles[arrayIndex].playerInfoBox.transform} >
      <div className="nm">
        {name}
      </div>
      <div className='chp'>
        {chips}
      </div>
      <div className="bt">
        {bet}
      </div>
    </PlayerInfoBox>
    <div 
      ref={this[`cards${arrayIndex}`]} // this.card0 should be ref
      id={`bp-${arrayIndex}`}
      className="betting-pinpoint"> 
      <CardContainer>
        { renderPlayerCards() }
      </CardContainer>
    </div>
    <pre style={{color: 'red'}}>{`${arrayIndex}`}</pre>
    </PlayerContainer>
  )
}

export default PlayerNew;