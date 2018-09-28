import React, { Component } from 'react';

const Spinner = props => {
	return(
		<React.Fragment>
			<div className='spinner-container' >
				<img src={'/assets/chip.svg'} />
			</div>
		</React.Fragment>
	)
}

export default Spinner