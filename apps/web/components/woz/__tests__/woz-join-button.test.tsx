import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WozJoinButton } from '../woz-join-button';
import { requestWomenOnlyZone } from '@/app/actions/women-only';

const mockRefresh = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh, push: mockPush }) }));
jest.mock('@/app/actions/women-only', () => ({ requestWomenOnlyZone: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('confirms pending submission without promising immediate access or allowing another request', async () => {
  (requestWomenOnlyZone as jest.Mock).mockResolvedValue({ error: null, status: 'pending' });
  render(<WozJoinButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Zugang beantragen' }));
  expect(await screen.findByRole('status')).toHaveTextContent('sobald er freigegeben ist');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

test.each(['returned', 'thrown'])('shows a retryable error when the request fails (%s)', async (failure) => {
  const request = requestWomenOnlyZone as jest.Mock;
  if (failure === 'thrown') request.mockRejectedValue(new Error('network'));
  else request.mockResolvedValue({ error: 'network' });
  render(<WozJoinButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Zugang beantragen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bitte versuche es erneut');
  expect(screen.getByRole('button')).toBeEnabled();
  expect(mockRefresh).not.toHaveBeenCalled();
});

test('sends expired sessions back to login with the WOZ destination', async () => {
  (requestWomenOnlyZone as jest.Mock).mockResolvedValue({ error: 'not_authenticated' });
  render(<WozJoinButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Zugang beantragen' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login?next=%2Fwoz'));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
