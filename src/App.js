/*
Create "ValidateBet" Util for Forms

*/

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
  handleAI
} from './utils/ai.js';

import { cloneDeep } from 'lodash';

const sliderStyle = {
  position: 'relative',
  width: 600,
  height: 80,
  border: '1px solid steelblue',
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
      numPlayersActive: 6,
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
    console.log(val)
    this.setState({
      betInputValue: val[0]
    })
    console.log(this.state.betInputValue)
  }
  handleBet = (bet, min, max) => {
    const newState = handleBet(cloneDeep(this.state), parseInt(bet), parseInt(min), parseInt(max));
      this.setState(newState);
  }
  handleFold = () => {
    const newState = handleFold(cloneDeep(this.state));
      this.setState(newState)
  }

  handleAI = () => {
    const newState = handleAI(cloneDeep(this.state))
    console.log(newState)
      this.setState(newState)
  }

  renderBoard = () => {
    // Reverse Players Array for the sake of taking turns counter-clockwise.
    const reversedPlayers = this.state.players.reduce((result, player, index) => {
      result.unshift(
        <React.Fragment>
        <div className={`p${index}${(index === this.state.activePlayerIndex) ? ' action' : ''}`}>
          <div className='player-avatar-container' >
            <img className='player-avatar-image' src={player.avatarURL} />
              {(this.state.dealerIndex === index) && 
                <React.Fragment>
                  <div className='dealer-chip-icon-container'>
                    <img src={'/assets/chip.svg'} />
                  </div>
                </React.Fragment>
            }
          </div>
                    <h5> {player.name} </h5>
          <h5> {`Chips: ${player.chips}`} </h5>
          <h5> {`Bet: ${player.bet}`} </h5>
          <h5> {`betReconciled: ${player.betReconciled}`} </h5>
          <div className='centered-flex-row abscard'>
            { this.renderPlayerCards(index) }
          </div>
          {(this.state.blindIndex.big === index) && <div style={{marginTop: '8px'}}> Big Blind </div>}
          {(this.state.blindIndex.small === index) && <div style={{marginTop: '8px'}}> Small Blind </div>}
        </div>
        </React.Fragment>

      )
      return result
    }, []);
    return reversedPlayers.map(component => component);
  }

  renderPlayerCards = (index) => {
    const { players } = this.state
    if (players[index].folded) return <div> Folded. </div>
    return players[index].cards.map(card => {
      return(
        <div className='playing-card' style={{animationDelay: `${card.animationDelay}ms`}}>
          <h6 style={{color: `${(card.suit === 'Diamond' || card.suit === 'Heart') ? 'red' : 'black'}`}}> {`${card.cardFace} ${renderUnicodeSuitSymbol(card.suit)}`}</h6>
        </div>
      );
    });
  }

  renderCommunityCards = () => {
    return this.state.communityCards.map(card => {
      return(
        <div className='playing-card' style={{animationDelay: `${card.animationDelay}ms`}}>
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
      (phase === 'betting1' || phase === 'betting2' || phase === 'betting3' || phase === 'betting4') ? (players[activePlayerIndex].robot) ? (<button onClick={this.handleAI}> AI Moves </button>) : (
        <React.Fragment>
        { /*
          <input 
            type='number'
            min={min}
            max={players[activePlayerIndex].chips + players[activePlayerIndex].bet}
            value={this.state.betInputValue}
            onChange={(e) => this.handleBetInputChange(e.target.value, min, max)}
          />
          <button
            onClick={() => this.handleBet(this.state.betInputValue, min, max)}>
              { this.renderActionButtonText() }
          </button>
          <button
            onClick={() => this.handleFold()}>
            Fold
          </button>
        */}
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
    if ((this.state.betInputValue === this.state.highBet) && (this.state.players[this.state.activePlayerIndex].bet == this.state.highBet)) {
      return 'Check'
    } else {
      return 'Bet'
    }
  }

  runGameLoop = () => {
    if (this.state.phase === 'initialDeal') {
      const newState = dealPrivateCards(cloneDeep(this.state))
        this.setState(newState)
    }
    if (this.state.phase === 'flop') {
      const newState = dealFlop(cloneDeep(this.state));
        this.setState(newState);
    }
  }

  renderBestHands = () => {
    const { players } = this.state
    return players.map(player => {
      return (
        <div className='centered-flex-row'> 
          <h6> {player.name} {`${(player.folded) ? 'Folded' : 'Active'}`}</h6>
            { 
               player.showDownHand.bestHand.map(card => {
                  return(
                    <div className='playing-card' style={{animationDelay: `0ms`}}>
                      <h6 style={{color: `${(card.suit === 'Diamond' || card.suit === 'Heart') ? 'red' : 'black'}`}}> {`${card.cardFace} ${renderUnicodeSuitSymbol(card.suit)}`}</h6>
                    </div>
                  )
              }) 
            }
          <h6> {player.showDownHand.bestHandRank} </h6>
        </div>
      )
    })
  }

  handleNextRound = () => {
    const newState = beginNextRound(cloneDeep(this.state))
      this.setState(newState)
  }
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Texas Hold 'Em</h1>
        </header>
          { (this.state.phase === 'showdown') && 
            <React.Fragment>
              <h5> SHOWDOWN TIME! </h5>
              { this.renderBestHands() }
              <button onClick={() => this.handleNextRound()}> Next Round </button>
            </React.Fragment>
          }
          <h2 style={{margin: '16px 0'}}> {renderPhaseStatement(this.state.phase)} </h2>
          <h6> {`Active Players: ${this.state.numPlayersActive}`} </h6>
          <h6> {`All-In Players: ${this.state.numPlayersAllIn}`} </h6>
          <h6> {`Folded Players: ${this.state.numPlayersFolded}`} </h6>
          <h4> {`POT: ${this.state.pot}`} </h4>
          <h1> Community Cards </h1>
        <div className='centered-flex-row'> 
          { this.renderCommunityCards() }
        </div>
        <h1> Players </h1>
        <div className='centered-flex-row'> 
          { (this.state.loading) ? <Spinner/> : (
              <div className='poker-players' style={{margin: '50px'}} > 
                <div className='top-game-menu-bar' />
                <div className='bottom-game-menu-bar' >
                  <div className='action-buttons'>
                    <div className='fold-btn' />
                    <div className='call-btn' />
                    <div className='bet-btn' />

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
