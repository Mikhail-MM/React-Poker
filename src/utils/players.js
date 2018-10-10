const axios = require('axios')

const generateTable = async () => {
	const users = [{
		name: 'Scarface Bojangles',
		avatarURL: '/assets/boy.svg',
		cards: [],
		showDownHand: {
			hand: [],
			descendingSortHand: [], 
		},
		chips: 2000,
		potChipLimit: 2000,
		bet: 0,
		betReconciled: false,
		folded: false,
	}];

	const response = await axios.get(`https://randomuser.me/api/?results=5&nat=us,gb,fr`);
	let randomUsers = response.data.results
		.map(user => ({ 
			name: `${user.name.first.charAt(0).toUpperCase()}${user.name.first.slice(1)} ${user.name.last.charAt(0).toUpperCase()}${user.name.last.slice(1)}`,
			avatarURL: user.picture.large,
			cards: [],
			chips: 2000,
			potChipLimit: 2000,
			showDownHand: {
				hand: [],
				descendingSortHand: [],
			},
			bet: 0,
			betReconciled: false,
			folded: false,
		}))
		.forEach(user => users.push(user))

	return users
}

const handleOverflowIndex = (currentIndex, incrementBy, arrayLength, direction) => {
	switch (direction) {
		case('up'): {
			return (
				(currentIndex + incrementBy) % arrayLength
			)
		}
		case('down'): {
			return (
				((currentIndex - incrementBy) % arrayLength) + arrayLength 
			)
		}
	}
}

export { generateTable, handleOverflowIndex }