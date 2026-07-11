import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import App from './App';

// Keep the smoke test offline: App fetches AI player identities from
// randomuser.me on mount. A pending promise holds the app on its loading
// screen, which is all this smoke test needs.
// (Implementation is set inside the test because CRA's jest config uses
// resetMocks: true, which wipes implementations given to the module factory.)
jest.mock('axios', () => ({ get: jest.fn() }));

it('renders without crashing', () => {
  axios.get.mockImplementation(() => new Promise(() => {}));
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
  ReactDOM.unmountComponentAtNode(div);
});
