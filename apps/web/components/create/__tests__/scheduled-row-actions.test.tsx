import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduledRowActions } from '../scheduled-row-actions';
import { cancelScheduledPost, reschedulePost } from '@/app/actions/posts';
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock('@/app/actions/posts', () => ({ cancelScheduledPost: jest.fn(), reschedulePost: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
function setup() { render(<ScheduledRowActions scheduledId="qa-scheduled" currentPublishAt={new Date(Date.now() + 3600_000).toISOString()} />); }

test('cancelling requires an explicit choice and a failed request stays visible for retry', async () => {
  jest.mocked(cancelScheduledPost).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, data: null });
  const user = userEvent.setup();
  setup(); await user.click(screen.getByRole('button', { name: 'Planung abbrechen' }));
  expect(cancelScheduledPost).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Planung abbrechen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('nicht gespeichert');
  expect(mockRefresh).not.toHaveBeenCalled();
  const retryButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Planung abbrechen' });
  // Error feedback can render before React finishes the pending transition.
  await waitFor(() => expect(retryButton).toBeEnabled());
  await user.click(retryButton);
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  expect(cancelScheduledPost).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('rescheduling blocks an empty time and preserves input when the request fails', async () => {
  jest.mocked(reschedulePost).mockRejectedValue(new Error('offline'));
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Umplanen' }));
  fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Morgen 09:00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('nicht gespeichert');
  expect(screen.getByLabelText('Uhrzeit')).toHaveValue('09:00');
  expect(mockRefresh).not.toHaveBeenCalled();
});

test('Escape closes rescheduling and restores focus to the trigger', async () => {
  const user = userEvent.setup(); setup(); await user.click(screen.getByRole('button', { name: 'Umplanen' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Umplanen' })).toHaveFocus();
});
