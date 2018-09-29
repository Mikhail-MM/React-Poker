const axios = require('axios')

const generateTable = async () => {
	const users = [{
		name: 'Scarface Bojangles',
		avatarURL: '/assets/boy.svg',
		cards: [],
		chips: 2000,
		bet: 0,
		betReconciled: false,
		didFold: false,
	}];

	const response = await axios.get(`https://randomuser.me/api/?results=5&nat=us,gb,fr`);
	let randomUsers = response.data.results
		.map(user => ({ 
			name: `${user.name.first} ${user.name.last}`,
			avatarURL: user.picture.large,
			cards: [],
			chips: 2000,
			bet: 0,
			betReconciled: false,
			didFold: false,
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