import { render, screen } from '@testing-library/react';
jest.mock('axios', () => ({
  create: () => ({ interceptors: { request: { use: jest.fn() } } })
}));
import App from './App';

test('renders the login page', () => {
  render(<App />);
  expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
});
