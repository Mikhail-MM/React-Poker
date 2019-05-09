import "@babel/polyfill";

import 'core-js/es6/map';
import 'core-js/es6/set';
import 'raf/polyfill';

import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import './Poker.css';
import Spinner from './Spinner';

import { Slider, Rail, Handles, Tracks, Ticks } from 'react-compound-slider'

import { 
  generateDeckOfCards, 
  shuffle, 
  popCards,
  dealPrivateCards,
  dealFlop,
} from './utils/cards.js';

import { 
  generateTable, 
  handleOverflowIndex,
  beginNextRound, 
} from './utils/players.js';

import { 
  determineBlindIndices, 
  anteUpBlinds, 
  determineMinBet,
  handleBet,
  handleFold, 
} from './utils/bet.js';

import { 
  renderPhaseStatement, 
  renderUnicodeSuitSymbol 
} from './utils/ui.js';

import {
  handleAI as handleAIUtil
} from './utils/ai.js';

import { cloneDeep } from 'lodash';

const sliderStyle = {
  position: 'relative',
  width: '100%',
  height: 80,
}

const railStyle = {
  position: 'absolute',
  width: '100%',
  height: 10,
  marginTop: 35,
  borderRadius: 5,
  backgroundColor: '#8B9CB6',
}

 function Handle({
  handle: { id, value, percent },
  getHandleProps
}) {
  return (
    <div
      style={{
        left: `${percent}%`,
        position: 'absolute',
        marginLeft: -15,
        marginTop: 25,
        zIndex: 2,
        width: 30,
        height: 30,
        border: 0,
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: '50%',
        backgroundColor: '#2C4870',
        color: '#aaa',
      }}
      {...getHandleProps(id)}
    >
      <div style={{ fontFamily: 'Roboto', fontSize: 11, marginTop: -35}} >
        {value}
      </div>
    </div>

  )
}

function Track ({ source, target, getTrackProps }) {
  return(
    <div
      style={{
        position: 'absolute',
        height: 10,
        zIndex: 1,
        marginTop: 35,
        backgroundColor: '#546C91',
        borderRadius: 5,
        cursor: 'pointer',
        left: `${source.percent}%`,
        width: `${target.percent - source.percent}%`,
      }}
      {...getTrackProps()}
    />

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
  handleBetInputSubmit = (bet, min, max) => {
  
    const newState = handleBet(cloneDeep(this.state), parseInt(bet), parseInt(min), parseInt(max));
  
      this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
          
            this.handleAI()
          }, 1200)
        }
      });
  }
  handleFold = () => {
    const newState = handleFold(cloneDeep(this.state));
  
      this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
          
            this.handleAI()
          }, 1200)
        }
      })
  }

  handleAI = () => {
    const newState = handleAIUtil(cloneDeep(this.state))
      this.setState({
            ...newState,
            betInputValue: newState.minBet // Need to remember the purpose of this...
      }, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
          
            this.handleAI()
          }, 1200)
        }
      })
  }

  renderBoard = () => {
    // Reverse Players Array for the sake of taking turns counter-clockwise.
    const reversedPlayers = this.state.players.reduce((result, player, index) => {
      result.unshift(
        <React.Fragment>
        <div className={`p${index}${(index === this.state.activePlayerIndex) ? ' action' : ''}`}>
          <div className='player-avatar-container' >
            <div className='bet-container'> 
              <img style={{width: 35, height: 35}} src={'./assets/bet.svg'} />
              <h5> {`Bet: ${player.bet}`} </h5> 
            </div>
            <img className={`player-avatar-image${(index === this.state.activePlayerIndex) ? ' activePlayer' : ''}`} src={player.avatarURL} />
              {(this.state.dealerIndex === index) && 
                <React.Fragment>
                  <div className='dealer-chip-icon-container'>
                    <img src={'/assets/chip.svg'} />
                  </div>
                </React.Fragment>
            }
          </div>
          <div className='player-info-box'>
                    <h5> {player.name} </h5>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <img style={{height: 35, width: 35}} src={'./assets/chips.svg'} />
                      <h5> {`${player.chips}`} </h5>
                    </div>
          </div>
          <div className='centered-flex-row abscard'>
            { this.renderPlayerCards(index) }
          </div>
        </div>
        </React.Fragment>

      )
      return result
    }, []);
    return reversedPlayers.map(component => component);
  }

  renderPlayerCards = (index) => {
    let applyFoldedClassname;
    const { players, activePlayerIndex } = this.state

    if (players[index].folded || this.state.clearCards) {
      applyFoldedClassname = true
    }

    if (players[index].robot) {
      return players[index].cards.map(card => {
        if (this.state.phase !== 'showdown') {
          return(
            <div key={`${card.suit} ${card.cardFace}`} className={`playing-card cardIn robotcard${(applyFoldedClassname ? ' folded' : '')}`} style={{animationDelay: `${(applyFoldedClassname) ?  0 : card.animationDelay}ms`}}>
            </div>
          );
        } else {
          return(
            <div key={`${card.suit} ${card.cardFace}`} className={`playing-card cardIn${(applyFoldedClassname ? ' folded' : '')}`} style={{animationDelay: `${(applyFoldedClassname) ?  0 : card.animationDelay}ms`}}>
              <h6 style={{color: `${(card.suit === 'Diamond' || card.suit === 'Heart') ? 'red' : 'black'}`}}> {`${card.cardFace} ${renderUnicodeSuitSymbol(card.suit)}`}</h6>
            </div>
          );
        }
      });
    }
    else {
      return players[index].cards.map(card => {
        return(
          <div key={`${card.suit} ${card.cardFace}`} className={`playing-card cardIn${(applyFoldedClassname ? ' folded' : '')}`} style={{animationDelay: `${(applyFoldedClassname) ?  0 : card.animationDelay}ms`}}>
            <h6 style={{color: `${(card.suit === 'Diamond' || card.suit === 'Heart') ? 'red' : 'black'}`}}> {`${card.cardFace} ${renderUnicodeSuitSymbol(card.suit)}`}</h6>
          </div>
        );
      });
    }

    if (this.state.clearCards) {
      console.log("Need to clear the cards")
      this.forceUpdate()
    }
  }

  renderCommunityCards = () => {
    return this.state.communityCards.map(card => {
      return(
        <div className='playing-card cardIn' style={{animationDelay: `${card.animationDelay}ms`}}>
          <h6 style={{color: `${(card.suit === 'Diamond' || card.suit === 'Heart') ? 'red' : 'black'}`}}> {`${card.cardFace} ${renderUnicodeSuitSymbol(card.suit)}`}</h6>
        </div>
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
    // Move to UI Utils
    // TODO: Add logic for CALL, RAISE
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
    if (this.state.phase === 'initialDeal') {
      const newState = dealPrivateCards(cloneDeep(this.state))
        this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => {
            this.handleAI()
          }, 1200)
        }
      })
    }
    if (this.state.phase === 'flop') {
      const newState = dealFlop(cloneDeep(this.state));
        this.setState(newState);
    }
  }

  renderBestHands = () => {
    const { players } = this.state
    // Run final ranking of all player hands in showdown
    return players.map(player => {
      if (!player.folded) {
          return (
            <div className='showdown-row'> 
              <h6 className='player-header'> {player.name} </h6>
              <div className='centered-flex-row' style={{alignItems: 'center'}}>
                { 
                    player.showDownHand.bestHand.map(card => {
                      return(
                        <div className='playing-card' style={{animationDelay: `0ms`}}>
                          <h6 style={{color: `${(card.suit === 'Diamond' || card.suit === 'Heart') ? 'red' : 'black'}`}}> {`${card.cardFace} ${renderUnicodeSuitSymbol(card.suit)}`}</h6>
                        </div>
                      )
                  }) 
                }
              </div>
              <h6>{player.showDownHand.bestHandRank}</h6>
            </div>
          )
      }
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
  render() {
    return (
      <div className="App">
        <div className='centered-flex-row'> 
          { (this.state.loading) ? <Spinner/> : (
              <div className='poker-players'>
                { (this.state.phase === 'showdown') && this.renderShowdown() } 
                <div className='top-game-menu-bar' >
                    <h4> Texas Hold 'Em Poker </h4>
                </div>
                <div className='pot-container'>
                  <img style={{height: 55, width: 55}} src={'./assets/pot.svg'}/>
                  <h4> {`${this.state.pot}`} </h4>
                </div>
                <div className='bottom-game-menu-bar' >
                  <div className='action-buttons'>
                      { this.renderActionButtons() }
                  </div>
                  <div className='slider-boi'>
                    { (!this.state.loading)  && this.renderActionMenu() }
                  </div>
                </div>
                <div className='chat-box' />
                { this.renderBoard() }
                <div className='community-card-container' >
                  { this.renderCommunityCards() }
                </div>
              </div>
              ) 
          }
        </div>
      </div>
    );
  }
}

export default App;
