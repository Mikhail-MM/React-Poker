import "@babel/polyfill";

import 'core-js/es6/map';
import 'core-js/es6/set';
import 'raf/polyfill';

import React, { Component } from 'react';
import './App.css';
import './Poker.css';
import Spinner from './Spinner';

import Player from "./components/players/Player";
import Card from "./components/cards/Card";

import Handle from "./components/slider/Handle";
import Track from "./components/slider/Track";
import { sliderStyle, railStyle } from "./components/slider/styles";

import { Slider, Rail, Handles, Tracks } from 'react-compound-slider'
import { CSSTransition } from 'react-transition-group';

import { 
  generateDeckOfCards, 
  shuffle, 
  dealPrivateCards,
} from './utils/cards.js';

import { 
  generateTable, 
  beginNextRound 
} from './utils/players.js';

import { 
  determineBlindIndices, 
  anteUpBlinds, 
  determineMinBet,
  handleBet,
  handleFold, 
} from './utils/bet.js';

import {
  handleAI as handleAIUtil
} from './utils/ai.js';

import { cloneDeep } from 'lodash';

function PlayerActionInfoBox({index, isActive, content, endTransition}) {
  
  return(
      <CSSTransition 
        in={isActive} 
        timeout={2000} 
        classNames="transitionable-actionBox" 
        onEntered={() => endTransition(index)}
      >
        <div className="actionBox">
          {`${index} ${isActive} -- ${content}`}
        </div>
      </CSSTransition>
    )
}

class App extends Component {
  state = {
    loading: true,
    players: null,
    numPlayersActive: null,
    numPlayersFolded: null,
    numPlayersAllIn: null,
    activePlayerIndex: null,
    dealerIndex: null,
    blindIndex: null,
    deck: null,
    communityCards: [],
    pot: null,
    highBet: null,
    betInputValue: null,
    sidePots: [],
    minBet: 20,
    phase: 'loading',
    showDownRender: [],
    playerHierarchy: [],
    playerAnimationSwitchboard: {
      0: {isAnimating: false, content: null},
      1: {isAnimating: false, content: null},
      2: {isAnimating: false, content: null},
      3: {isAnimating: false, content: null},
      4: {isAnimating: false, content: null},
      5: {isAnimating: false, content: null}
    }
  }

  cardAnimationDelay = 0;

  async componentDidMount() {
    const players = await generateTable();
    const dealerIndex = Math.floor(Math.random() * Math.floor(players.length));
    const blindIndicies = determineBlindIndices(dealerIndex, players.length);
    const playersBoughtIn = anteUpBlinds(players, blindIndicies, this.state.minBet);
    this.setState(prevState => ({
      loading: false,
      players: playersBoughtIn,
      numPlayersActive: players.length,
      numPlayersFolded: 0,
      numPlayersAllIn: 0,
      activePlayerIndex: dealerIndex,
      dealerIndex,
      blindIndex: {
        big: blindIndicies.bigBlindIndex,
        small: blindIndicies.smallBlindIndex,
      },
      deck: shuffle(generateDeckOfCards()),
      pot: 0,
      highBet: prevState.minBet,
      betInputValue: prevState.minBet,
      phase: 'initialDeal',
    }))
    this.runGameLoop();
  }

  handleBetInputChange = (val, min, max) => {
    if (val === '') val = min
    if (val > max) val = max
      this.setState({
        betInputValue: parseInt(val),
      });
  }
  
  changeSliderInput = (val) => {
    this.setState({
      betInputValue: val[0]
    })
  }

  pushAnimationState = (index, content) => {
    const newAnimationSwitchboard = Object.assign(
      {}, 
      this.state.playerAnimationSwitchboard,
      {[index]: {isAnimating: true, content}}     
    )
    this.setState({playerAnimationSwitchboard: newAnimationSwitchboard});
  }

  popAnimationState = (index) => {
    const persistContent = this.state.playerAnimationSwitchboard[index].content;
    const newAnimationSwitchboard = Object.assign(
      {}, 
      this.state.playerAnimationSwitchboard,
      {[index]: {isAnimating: false, content: persistContent}}     
    )
    this.setState({playerAnimationSwitchboard: newAnimationSwitchboard});
  }

  handleBetInputSubmit = (bet, min, max) => {
    const {playerAnimationSwitchboard, ...appState} = this.state;
    const { activePlayerIndex } = appState;
    this.pushAnimationState(activePlayerIndex, `BET/CALL: ${bet}`);
    const newState = handleBet(cloneDeep(appState), parseInt(bet), parseInt(min), parseInt(max));
      this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
          
            this.handleAI()
          }, 1200)
        }
      });
  }

  handleFold = () => {
    const {playerAnimationSwitchboard, ...appState} = this.state
    const newState = handleFold(cloneDeep(appState));
      this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
          
            this.handleAI()
          }, 1200)
        }
      })
  }

  handleAI = () => {
    const {playerAnimationSwitchboard, ...appState} = this.state;
    const newState = handleAIUtil(cloneDeep(appState), this.pushAnimationState)

      this.setState({
            ...newState,
            betInputValue: newState.minBet
      }, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
          
            this.handleAI()
          }, 1200)
        }
      })
  }

  ifAnimating = (playerBoxIndex) => { 
    const { playerAnimationSwitchboard } = this.state;
    if (playerAnimationSwitchboard[playerBoxIndex].isAnimating) {
      return true;
    } else {
      return false;
    }

  }

  renderBoard = () => {
    const { 
      players,
      activePlayerIndex,
      dealerIndex,
      clearCards,
      phase,
    } = this.state;
    // Reverse Players Array for the sake of taking turns counter-clockwise.
    const reversedPlayers = players.reduce((result, player, index) => {
      
      const isActive = (index === activePlayerIndex);
      const hasDealerChip = (index === dealerIndex);


      result.unshift(
        <React.Fragment key={index}>
          <PlayerActionInfoBox 
            index={index} 
            isActive={this.ifAnimating(index)} 
            content={this.state.playerAnimationSwitchboard[index].content}
            endTransition={this.popAnimationState}
          />
          <Player
            key={index}
            arrayIndex={index}
            isActive={isActive}
            hasDealerChip={hasDealerChip}
            player={player}
            clearCards={clearCards}
            phase={phase}      
          />
        </React.Fragment>

      )
      return result
    }, []);
    return reversedPlayers.map(component => component);
  }

  renderCommunityCards = () => {
    return this.state.communityCards.map((card, index) => {
      return(
        <Card key={index} cardData={card}/>
      );
    });
  }
  
  renderActionMenu = () => {
    const { highBet, players, activePlayerIndex, phase } = this.state
    const min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
    const max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
    return(
      (phase === 'betting1' || phase === 'betting2' || phase === 'betting3' || phase === 'betting4') ? (players[activePlayerIndex].robot) ? (<h4> {`Current Move: ${players[activePlayerIndex].name}`}</h4>) : (
        <React.Fragment>
        <Slider
          rootStyle={sliderStyle}
          domain={[min, max]}
          values={[min]}
          step={1}

          onChange={this.changeSliderInput}
            mode={2}
        >
          <Rail>
            {
              ({ getRailProps }) => (
                <div style={railStyle} {...getRailProps()} />
              )
            }
          </Rail>
          <Handles>
            { 
              ({ handles, getHandleProps}) => (
                <div className='slider-handles'>
                  { 
                    handles.map(handle => (
                      <Handle
                        key={handle.id}
                        handle={handle}
                        getHandleProps={getHandleProps}
                      />
                    ))
                  }
                </div>
              )
            }
          </Handles>
          <Tracks right={false}>
            {
              ({ tracks, getTrackProps }) => (
                <div className='slider-tracks'>
                  {
                    tracks.map(
                      ({ id, source, target }) => (
                        <Track
                          key={id}
                          source={source}
                          target={target}
                          getTrackProps={getTrackProps}
                        />
                      )
                    )
                  }
                </div>
              )
            }
          </Tracks>
        </Slider>
        </React.Fragment>
      ) : null
    )
  }

  renderActionButtonText() {
    const { highBet, betInputValue, players, activePlayerIndex } = this.state
    const activePlayer = players[activePlayerIndex]
    if ((highBet === 0) && (betInputValue === 0)) {
      return 'Check'
    } else if ((highBet === betInputValue)) {
      return 'Call'
    } else if ((highBet === 0) && (betInputValue > highBet)) {
      return 'Bet'
    } else if ((betInputValue < highBet) || (betInputValue === activePlayer.chips)) {
      return 'All-In!'
    } else if (betInputValue > highBet) {
      return 'Raise'
    } 
  }

  runGameLoop = () => {
    const newState = dealPrivateCards(cloneDeep(this.state))
    this.setState(newState, () => {
      if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
        setTimeout(() => {
          this.handleAI()
        }, 1200)
      }
    })
  }

  renderRankTie = (rankSnapshot) => {
    return rankSnapshot.map(player => {
      return this.renderRankWinner(player);
    })
  }

  renderRankWinner = (player) => {
    const { name, bestHand, handRank } = player;
    return (
      <div key={name}>
        <h6 className='player-header'> {name} </h6>
        <div className='centered-flex-row' style={{alignItems: 'center'}}>
          {
            bestHand.map((card, index) => {
              // Reset Animation Delay
              const cardData = {...card, animationDelay: 0}
              return <Card key={index} cardData={cardData}/>
            })
          }
        </div>
        <div>{handRank}</div>
      </div>
    )
  }

  renderBestHands = () => {
    const { playerHierarchy } = this.state;
    return playerHierarchy.map(rankSnapshot => {
      const tie = Array.isArray(rankSnapshot);
      return tie ? this.renderRankTie(rankSnapshot) : this.renderRankWinner(rankSnapshot);
    })
  }

  handleNextRound = () => {
    this.setState({clearCards: true})
    const newState = beginNextRound(cloneDeep(this.state))
    // TODO: CHECK WIN CONDITION HERE
      this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => this.handleAI(), 1200)
        }
      })
  }

  renderActionButtons = () => {
    const { highBet, players, activePlayerIndex, phase } = this.state
    const min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
    const max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
    return ((players[activePlayerIndex].robot) || (this.state.phase === 'showdown')) ? null : (
      <React.Fragment>
      <button className='action-button' onClick={() => this.handleBetInputSubmit(this.state.betInputValue, min, max)}>
          {this.renderActionButtonText()}
      </button>
      <button className='fold-button' onClick={() => this.handleFold()}>
        Fold
      </button>
      </React.Fragment>
      )
  }
  
  renderShowdown = () => {
    return(
      <div className='showdown-container'>
        { this.renderBestHands() }
        <button onClick={() => this.handleNextRound()}> Next Round </button>
      </div>
    )
  }

  renderGame = () => {
    return (
      <div className='poker-app--background'>
        <div className="poker-table--container">
          <img className="poker-table--table-image" src={"./assets/table-nobg-svg-01.svg"} />
          { this.renderBoard() }
          <div className='community-card-container' >
            { this.renderCommunityCards() }
          </div>
          <div className='pot-container'>
            <img style={{height: 55, width: 55}} src={'./assets/pot.svg'}/>
            <h4> {`${this.state.pot}`} </h4>
          </div>
        </div>
        { (this.state.phase === 'showdown') && this.renderShowdown() } 
        <div className='bottom-game-menu-bar' >
          <div className='action-buttons'>
              { this.renderActionButtons() }
          </div>
          <div className='slider-boi'>
            { (!this.state.loading)  && this.renderActionMenu() }
          </div>
        </div>
        <div className='chat-box' />
      </div>
    )
  }
  render() {
    return (
      <div className="App">
        <div className='poker-table--wrapper'> 
          { (this.state.loading) ? <Spinner/> : this.renderGame()}
        </div>
      </div>
    );
  }
}

export default App;
