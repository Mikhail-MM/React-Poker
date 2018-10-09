/*
Create "ValidateBet" Util for Forms

*/

import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import './Poker.css';
import Spinner from './Spinner';

import { 
  fullDeck, 
  shuffle, 
  popCards,
  dealFlop,
} from './utils/cards.js';

import { 
  generateTable, 
  handleOverflowIndex 
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

import { cloneDeep } from 'lodash';

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
    phase: 'loading',
  }

  cardAnimationDelay = 0;
  minBet = 20;

  async componentDidMount() {
    const players = await generateTable();
    const dealerIndex = Math.floor(Math.random() * Math.floor(players.length));
    const blindIndicies = determineBlindIndices(dealerIndex, players.length);
    const playersBoughtIn = anteUpBlinds(players, blindIndicies, this.minBet);
    this.setState({
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
      deck: shuffle(fullDeck),
      pot: 0,
      highBet: this.minBet,
      betInputValue: this.minBet,
      phase: 'initialDeal',
    })
    this.runGameLoop();
  }

  dealInitialCards = () => {
    // TODO: Implement as Util Function, Separate Business Logic From Main React Component
    this.setState(prevState => {
      if (prevState.players[prevState.activePlayerIndex].cards.length === 2) {
        return({
          activePlayerIndex: handleOverflowIndex(prevState.blindIndex.big, 1, prevState.players.length, 'up'),
          phase: 'betting1',
        })
      } else if (prevState.players[prevState.activePlayerIndex].cards.length < 2) {
          const { mutableDeckCopy, chosenCards } = popCards(prevState.deck, 1)
          chosenCards.animationDelay = this.cardAnimationDelay;
          this.cardAnimationDelay = this.cardAnimationDelay + 250;
          const newDeck = [...mutableDeckCopy];
          const newPlayersInstance = [...prevState.players];
            newPlayersInstance[prevState.activePlayerIndex].cards.push(chosenCards);
              return({
                players: newPlayersInstance,
                activePlayerIndex: handleOverflowIndex(prevState.activePlayerIndex, 1, prevState.players.length, 'up'),
                deck: newDeck,
              });
      }
    });
  }

  handleBetInputChange = (val, min, max) => {
    if (val === '') val = min
    if (val > max) val = max
      this.setState({
        betInputValue: val,
      });
  }
  
  handleBet = (bet, min, max) => {
    const newState = handleBet(cloneDeep(this.state), parseInt(bet), parseInt(min), parseInt(max));
      this.setState(newState);
  }
  handleFold = () => {
    const newState = handleFold(cloneDeep(this.state));
      this.setState(newState)
  }

  renderPlayers = () => {
    // Reverse Players Array for the sake of taking turns counter-clockwise.
    const reversedPlayers = this.state.players.reduce((result, player, index) => {
      result.unshift(
        <div className='flex-centered-column' style={{margin: '0 16px', backgroundColor: `${(index === this.state.activePlayerIndex) ? 'rgba(136, 124, 175, 0.25)' : 'transparent'}`}}>
          <div className='player-avatar-container'>
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
          <div className='centered-flex-row'>
            { this.renderPlayerCards(index) }
          </div>
          {(this.state.blindIndex.big === index) && <div style={{marginTop: '8px'}}> Big Blind </div>}
          {(this.state.blindIndex.small === index) && <div style={{marginTop: '8px'}}> Small Blind </div>}
        </div>
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
    const min = determineMinBet(highBet, players[activePlayerIndex].chips)
    const max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
    return(
      (phase === 'betting1' || phase === 'betting2' || phase === 'betting3' || phase === 'betting4') ? (
        <React.Fragment>
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
        </React.Fragment>
      ) : null
    )
  }

  renderActionButtonText() {
    // Move to UI Utils
    const { highBet } = this.state
    if ((this.state.betInputValue === 0) && (highBet === 0)) {
      return 'Check'
    } else {
      return 'Bet'
    }
  }

  runGameLoop = () => {
    while (this.state.phase === 'initialDeal') {
      this.dealInitialCards()
    }
    if (this.state.phase === 'flop') {
      const newState = dealFlop(cloneDeep(this.state));
        this.setState(newState);
    }
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Texas Hold 'Em</h1>
        </header>
          <h2 style={{margin: '16px 0'}}> {renderPhaseStatement(this.state.phase)} </h2>
          <h6> {`Active Players: ${this.state.numPlayersActive}`} </h6>
          <h6> {`All-In Players: ${this.state.numPlayersAllIn}`} </h6>
          <h6> {`Folded Players: ${this.state.numPlayersFolded}`} </h6>
          <h4> {`POT: ${this.state.pot}`} </h4>
          <h1> Community Cards </h1>
        <div className='centered-flex-row' style={{minHeight: '50px'}}>
        </div>
        <div className='centered-flex-row'> 
          { this.renderCommunityCards() }
        </div>
        <h1> Players </h1>
        <div className='centered-flex-row'> 
          { (this.state.loading) ? <Spinner/> : this.renderPlayers() }
        </div>
        <div className='centered-flex-row' style={{marginTop: '16px'}}> 
          { (!this.state.loading)  && this.renderActionMenu() }
        </div>
      </div>
    );
  }
}

export default App;
