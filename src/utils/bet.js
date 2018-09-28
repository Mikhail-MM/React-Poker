/*
const determineBlindIndices = (dealerIndex, numPlayers) => {
	let bigBlindIndex;
	let smallBlindIndex;
	/*return({
		bigBlindIndex: (dealerIndex + 2) % numPlayers,
		smallBlindIndex: (dealerIndex + 1) % numPlayers
	})

		This method is unnecessary if we reverse the array of players. The idea is that when we iterate on an array, we move from left to right. However, when determining 
	the position of the blinds and taking turns in poker, we actually move from right to left. To follow with the rhythm of Poker, we would be iterating the index  of the 
	active playerDOWN ... leading to issues -
	since we can go below 0 (If we go over the length of the array, we can return to the start by doing modulo % array.length. However, itertaing down, we will reach -1, and would need to compensate)



	if ((dealerIndex - 2) < 0) {
		// Ensure that we cycle around to the other end of the array if moving left of the Dealer chip brings us to a negative 
		bigBlindIndex = ((dealerIndex - 2) % numPlayers) + numPlayers
	} else {
		bigBlindIndex = dealerIndex - 2
	}	
	if ((dealerIndex - 1) < 0) {
		smallBlindIndex = ((dealerIndex - 1) % numPlayers) + numPlayers
	} else { 
		smallBlindIndex = dealerIndex - 1
	}
	
	return { bigBlindIndex, smallBlindIndex }	
}
*/

const determineBlindIndices = (dealerIndex, numPlayers) => {
	return({
		bigBlindIndex: (dealerIndex + 2) % numPlayers,
		smallBlindIndex: (dealerIndex + 1) % numPlayers
	})
}
export { determineBlindIndices }