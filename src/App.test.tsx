// Renders the app, so it needs a document. The suite default is node.
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
