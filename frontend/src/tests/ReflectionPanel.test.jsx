import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReflectionPanel from '../components/ReflectionPanel';
import { agentRequest } from '../agentApi';
vi.mock('../agentApi', () => ({ agentRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
function setupUser() {
  const raw = userEvent.setup();
  return Object.fromEntries(['click', 'type', 'clear'].map(method => [method, async (...args) => {
    await act(async () => { await raw[method](...args); });
  }]));
}

it('starts without history permission and preserves input after a failed request', async () => {
  agentRequest.mockResolvedValueOnce({ id: 's', state: 'observing' }).mockRejectedValueOnce(new Error('Model unavailable'));
  const user = setupUser();
  render(<ReflectionPanel />);
  await user.click(screen.getByRole('button', { name: 'Start a reflection' }));
  expect(agentRequest.mock.calls[0][1].body).toMatchObject({ history: false, notes: false });
  const input = screen.getByRole('textbox', { name: 'What would you like to reflect on?' });
  await user.type(input, 'Lunch felt rushed');
  await user.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Model unavailable');
  expect(input).toHaveValue('Lunch felt rushed');
});

it('only sends edited goal text after the user explicitly saves the draft', async () => {
  agentRequest.mockResolvedValueOnce({ id: 's', state: 'observing' }).mockResolvedValueOnce({
    message: 'Review this intention.', state: 'offering', sources: [], evidence: [],
    actions: [{ id: 'a', kind: 'goal', payload: { title: 'Notice today' }, payload_hash: 'hash' }],
  }).mockResolvedValueOnce({ saved: true });
  const user = setupUser();
  render(<ReflectionPanel />);
  await user.click(screen.getByRole('button', { name: 'Start a reflection' }));
  await user.type(screen.getByRole('textbox', { name: 'What would you like to reflect on?' }), 'Please make an intention');
  await user.click(screen.getByRole('button', { name: 'Send' }));
  const draft = await screen.findByRole('textbox', { name: 'Intention' });
  expect(agentRequest).toHaveBeenCalledTimes(2);
  await user.clear(draft); await user.type(draft, 'Ask a friend for company');
  await user.click(screen.getByRole('button', { name: 'Save this version' }));
  await waitFor(() => expect(agentRequest).toHaveBeenCalledTimes(3));
  expect(agentRequest.mock.calls[2]).toEqual(['/sessions/s/actions/a', { method: 'POST', body: { decision: 'confirm', payload: { title: 'Ask a friend for company' }, payload_hash: 'hash' } }]);
  expect(await screen.findByText('Saved the version you confirmed.')).toBeInTheDocument();
});

it('sends a separate correction event instead of accepting a pattern', async () => {
  agentRequest.mockResolvedValueOnce({ id: 's', state: 'observing' }).mockResolvedValueOnce({
    message: 'Lunch might be harder on class days. Does that fit?', state: 'awaiting_verification', actions: [],
  }).mockResolvedValueOnce({ message: 'Thanks for correcting that.', state: 'rejected', actions: [] });
  const user = setupUser(); render(<ReflectionPanel />);
  await user.click(screen.getByRole('button', { name: 'Start a reflection' }));
  await user.type(screen.getByRole('textbox', { name: 'What would you like to reflect on?' }), 'Look at the sample history');
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await user.click(await screen.findByRole('button', { name: 'That doesn’t fit' }));
  expect(agentRequest.mock.calls[2][1].body.event).toBe('correct');
});
