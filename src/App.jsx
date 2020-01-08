import "@babel/polyfill";

import 'core-js/es6/map';
import 'core-js/es6/set';
import 'raf/polyfill';

import React, { Component } from 'react';
import {useMediaQuery} from 'react-responsive';

import './styles/Poker.css'

import Spinner from './components/Spinner';
import WinScreen from './components/WinScreen'

import Player from "./components/players/Player";
import PlayerNew from "./components/players/Player-v2";

import ShowdownPlayer from "./components/players/ShowdownPlayer";
import Card from "./components/cards/Card";

import { 
  generateDeckOfCards, 
  shuffle, 
  dealPrivateCards,
} from './utils/cards.js';

import { 
  generateTable, 
  beginNextRound,
  checkWin,
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

import {
  renderShowdownMessages,
  renderActionButtonText,
  renderNetPlayerEarnings,
  renderActionMenu
} from './utils/ui.js';

import { cloneDeep } from 'lodash';
import sc from 'styled-components';

const NUM_AI_PLAYERS = 6;

const markerSize = 50

const TABLE_CENTER_MARKER = sc.div`
  position: absolute;
  width: ${markerSize}px;
  height: ${markerSize}px;
  z-index: 10000;
  background-color: black;
  border: white;
  top: 3%;
  left: calc(50% - ${markerSize/2}px);
`;

const CheckScreen = () => {
  const isDesktopOrLaptop = useMediaQuery({
    query: '(min-device-width: 1224px)'
  })
  const isBigScreen = useMediaQuery({ query: '(min-device-width: 1824px)' })
  const isTabletOrMobile = useMediaQuery({ query: '(max-width: 1224px)' })
  const isTabletOrMobileDevice = useMediaQuery({
    query: '(max-device-width: 1224px)'
  })
  const isPortrait = useMediaQuery({ query: '(orientation: portrait)' })
  const isRetina = useMediaQuery({ query: '(min-resolution: 2dppx)' })
 
  return (
    <div>
      <h1>Device Test!</h1>
      {isDesktopOrLaptop && <div>
        <p>You are a desktop or laptop</p>
        {isBigScreen && <p>You also have a huge screen</p>}
        {isTabletOrMobile && <p>You are sized like a tablet or mobile phone though</p>}
      </div>}
      {isTabletOrMobileDevice && <p>You are a tablet or mobile phone</p>}
      <p>Your are in {isPortrait ? 'portrait' : 'landscape'} orientation</p>
      {isRetina && <p>You are retina</p>}
    </div>
  )
}

function analyzeScreen() {
  console.log(window)
}

class App extends Component {
  state = {
    loading: true,
    winnerFound: null,
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
    playerHierarchy: [],
    showDownMessages: [],
    playActionMessages: [],
    playerAnimationSwitchboard: {},
    animeSwitchboard: {},
  }

  cardAnimationDelay = 0;

  
    tableRef = React.createRef();
    tableCenterMarker = React.createRef();
    cards0 = React.createRef();
    cards1 = React.createRef();
    cards2 = React.createRef();
    cards3 = React.createRef();
    cards4 = React.createRef();
    cards5 = React.createRef();
    cards6 = React.createRef();
    cards7 = React.createRef();

  async componentDidMount() {
    analyzeScreen();
    console.log("HELLO!?")

    const { players, playerAnimationSwitchboard } = await generateTable(NUM_AI_PLAYERS);
    const dealerIndex = Math.floor(Math.random() * Math.floor(players.length));
    const blindIndicies = determineBlindIndices(dealerIndex, players.length);
    const playersBoughtIn = anteUpBlinds(players, blindIndicies, this.state.minBet);
    
    const imageLoaderRequest = new XMLHttpRequest();

    imageLoaderRequest.addEventListener("load", e => {
      this.setState({
        loading: false,
      })
    });
    imageLoaderRequest.open("GET", "./assets/table-nobg-svg-01.svg");
    imageLoaderRequest.send();

    this.setState(prevState => ({
      // loading: false,
      players: playersBoughtIn,
      playerAnimationSwitchboard,
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

  componentDidUpdate() {
    console.log(this.tableRef);
    console.log(this.tableCenterMarker)
    console.log(this.cards0);
  }

  handleBetInputChange = (val, min, max) => {
    if (val === '') val = min
    if (val > max) val = max
      this.setState({
        betInputValue: parseInt(val, 10),
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
    this.pushAnimationState(activePlayerIndex, `${renderActionButtonText(this.state.highBet, this.state.betInputValue, this.state.players[this.state.activePlayerIndex])} ${(bet > this.state.players[this.state.activePlayerIndex].bet) ? (bet) : ""}`);;
    const newState = handleBet(cloneDeep(appState), parseInt(bet, 10), parseInt(min, 10), parseInt(max, 10));
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

  renderBoard = () => {
    const { 
      players,
      activePlayerIndex,
      dealerIndex,
      clearCards,
      phase,
      playerAnimationSwitchboard
    } = this.state;
    // Reverse Players Array for the sake of taking turns counter-clockwise.
    const reversedPlayers = players.reduce((result, player, index) => {
      
      const isActive = (index === activePlayerIndex);
      const hasDealerChip = (index === dealerIndex);


      result.unshift(
          <Player
            key={index}
            arrayIndex={index}
            isActive={isActive}
            hasDealerChip={hasDealerChip}
            player={player}
            clearCards={clearCards}
            phase={phase}
            playerAnimationSwitchboard={playerAnimationSwitchboard}      
            endTransition={this.popAnimationState}
          />
      )
      return result
    }, []);
    return reversedPlayers.map(component => component);
  }

  renderCommunityCards = (purgeAnimation) => {
    return this.state.communityCards.map((card, index) => {
      let cardData = {...card};
      if (purgeAnimation) {
        cardData.animationDelay = 0;
      }
      return(
        <Card key={index} cardData={cardData}/>
      );
    });
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
    const playerStateData = this.state.players.find(statePlayer => statePlayer.name === name);
    return (
      <div className="showdown-player--entity" key={name}>
        <ShowdownPlayer
          name={name}
          avatarURL={playerStateData.avatarURL}
          cards={playerStateData.cards}
          roundEndChips={playerStateData.roundEndChips}
          roundStartChips={playerStateData.roundStartChips}
        />
        <div className="showdown-player--besthand--container">
          <h5 className="showdown-player--besthand--heading">
            Best Hand
          </h5>
          <div className='showdown-player--besthand--cards' style={{alignItems: 'center'}}>
            {
              bestHand.map((card, index) => {
                // Reset Animation Delay
                const cardData = {...card, animationDelay: 0}
                return <Card key={index} cardData={cardData}/>
              })
            }
          </div>
        </div>
        <div className="showdown--handrank">
          {handRank}
        </div>
        {renderNetPlayerEarnings(playerStateData.roundEndChips, playerStateData.roundStartChips)}
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
    // Check win condition
    if(checkWin(newState.players)) {
      this.setState({ winnerFound: true })
      return;
    }
      this.setState(newState, () => {
        if((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
          setTimeout(() => this.handleAI(), 1200)
        }
      })
  }

  renderActionButtons = () => {
    const { highBet, players, activePlayerIndex, phase, betInputValue } = this.state
    const min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
    const max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
    return ((players[activePlayerIndex].robot) || (phase === 'showdown')) ? null : (
      <React.Fragment>
        <button className='action-button' onClick={() => this.handleBetInputSubmit(betInputValue, min, max)}>
          {renderActionButtonText(highBet, betInputValue, players[activePlayerIndex])}
        </button>
        <button className='fold-button' onClick={() => this.handleFold()}>
          Fold
        </button>
      </React.Fragment>
      )
  }

  renderShowdown = () => {
    return(
      <div className='showdown-container--wrapper'>
        <h5 className="showdown-container--title">
          Round Complete!
        </h5>
        <div className="showdown-container--messages">
          { renderShowdownMessages(this.state.showDownMessages)}
        </div>
        <h5 className="showdown-container--community-card-label">
          Community Cards
        </h5>
        <div className='showdown-container--community-cards'>
          { this.renderCommunityCards(true) }
        </div>
        <button className="showdown--nextRound--button" onClick={() => this.handleNextRound()}> Next Round </button>
          { this.renderBestHands() }
      </div>
    )
  }
  
  renderGame = () => {
    const { highBet, players, activePlayerIndex, clearCards, phase } = this.state;
    return (
      <div className='poker-app--background'>
        <div ref={this.tableRef} className="poker-table--container">
        <TABLE_CENTER_MARKER ref={this.tableCenterMarker}/>
          <img className="poker-table--table-image" src={"./assets/table-nobg-svg-01.svg"} alt="Poker Table" />
          {players.map((player, arrayIndex) => {
              return <PlayerNew
                key={arrayIndex}  
                player={player}
                activePlayerIndex={activePlayerIndex}
                phase={phase}
                clearCards={clearCards}
                arrayIndex={arrayIndex}/>
            })
          }
          {/* Old players method -- uncomment and remove display:none style to revert
             this.renderBoard() 
          */}
          <div className='community-card-container' >
            { this.renderCommunityCards() }
          </div>
          <div className='pot-container'>
            <img style={{height: 55, width: 55}} src={'./assets/pot.svg'} alt="Pot Value"/>
            <h4> {`${this.state.pot}`} </h4>
          </div>
        </div>
        { (this.state.phase === 'showdown') && this.renderShowdown() } 
        <div className='game-action-bar' >
          <div className='action-buttons'>
              { this.renderActionButtons() }
          </div>
          <div className='slider-boi'>
            { (!this.state.loading)  && renderActionMenu(highBet, players, activePlayerIndex, phase, this.handleBetInputChange)}
          </div>
        </div>
      </div>
    )
  }
  render() {
    return (
      <div className="App">
        <div className='poker-table--wrapper'> 
          { 
            (this.state.loading) ? <Spinner/> : 
            (this.state.winnerFound) ? <WinScreen /> : 
            this.renderGame()
          }
        </div>
        <CheckScreen />
      </div>
    );
  }
}

export default App;
