const renderPhaseStatement = (phase) => {
	if (phase === 'loading') {
		return "Finding a Table..."
	} else if (phase === 'initialDeal') {
		return  "Dealing out the cards!"
	} else {
		return "Houston, we have a problem! (Unknown Error! Ruh-roh)"
	}
}

export { renderPhaseStatement }