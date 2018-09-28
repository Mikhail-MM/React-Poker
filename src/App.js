import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import './Poker.css';

import { fullDeck, shuffle, popCards} from './utils/cards.js';
import { generateTable, handleOverflowIndex } from './utils/players.js';
import { determineBlindIndices } from './utils/bet.js'
import { renderPhaseStatement } from './utils/ui.js';
import Spinner from './Spinner'

class App extends Component {
  state = {
    players: null,
    dealerIndex: null,
    activePlayerIndex: null,
    deck: null,
    loading: true,
    phase: 'loading',
  }

  async componentDidMount() {
    const players = await generateTable();
    const dealerIndex = Math.floor(Math.random() * Math.floor(players.length));
    const blindIndicies = determineBlindIndices(dealerIndex, players.length)
    console.log(dealerIndex, blindIndicies)
    this.setState({
      loading: false,
      players,
      phase: 'initialDeal',
      deck: shuffle(fullDeck),
      dealerIndex,
      activePlayerIndex: dealerIndex,
      blindIndex: {
        big: blindIndicies.bigBlindIndex,
        small: blindIndicies.smallBlindIndex,
      }
    })
    console.log(this.state.deck)
    this.runGameLoop()
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
          <div className='centered-flex-row'>
            { this.renderPlayerCards(index) }
          </div>
          {(this.state.blindIndex.big === index) && <div> Big Blind </div>}
          {(this.state.blindIndex.small === index) && <div> Small Blind </div>}
        </div>
      )
      return result
    }, [])
    return reversedPlayers.map(component => component)
  }

  renderPlayerCards = (index) => {
    return this.state.players[index].cards.map(card => {
      return(
        <div className='playing-card'>
          <h6> {`${card.cardFace}${card.suit[0]}`}</h6>
        </div>
      )
    })
  }

  dealInitialCards = () => {
    this.setState(prevState => {
      if (prevState.players[prevState.activePlayerIndex].cards.length === 2) {
        return({
          phase: 'betting1',
          activePlayerIndex: prevState.dealerIndex
        })
      } else if (prevState.players[prevState.activePlayerIndex].cards.length < 2) {
          const { mutableDeckCopy, chosenCards } = popCards(prevState.deck, 1)
          const newDeck = [...mutableDeckCopy]
          const newPlayersInstance = [...prevState.players]
            newPlayersInstance[prevState.activePlayerIndex].cards.push(chosenCards)
              return({
                deck: newDeck,
                players: newPlayersInstance,
                activePlayerIndex: handleOverflowIndex(prevState.activePlayerIndex, 1, prevState.players.length, 'up')
              })
      }
    })
  }

  runGameLoop = () => {
    while (this.state.phase === 'initialDeal') {
      this.dealInitialCards()
    }
    while (this.state.phase === 'betting1') {
      return console.log(this.state)
    }
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Texas Hold 'Em</h1>
        </header>
          <h2 style={{margin: '16px 0'}}> {renderPhaseStatement(this.state.phase)} </h2>
        <div className='centered-flex-row'> 
          { (this.state.loading) ? <Spinner/> : this.renderPlayers() }
        </div>
          { (this.state.loading) ? <h5> Loading Players... </h5> : null}
      </div>
    );
  }
}

export default App;
