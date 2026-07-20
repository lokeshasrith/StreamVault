import { describe, expect, it, vi } from 'vitest';
import { authHeader, get } from './http';

describe('http authHeader', () => {
  it('returns auth header when token exists', () => {
    expect(authHeader('token-123')).toEqual({ Authorization: 'Bearer token-123' });
  });

  it('returns empty object when token is missing', () => {
    expect(authHeader()).toEqual({});
  });
});

describe('http get', () => {
  it('returns parsed json for successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, id: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const result = await get<{ ok: boolean; id: number }>('/api/ping');
    expect(result).toEqual({ ok: true, id: 1 });
    const calledUrl = (vi.mocked(fetch).mock.calls[0]?.[0] as string) ?? '';
    const calledInit = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(calledUrl).toContain('/api/ping');
    expect(calledInit).toEqual({ headers: {} });
  });

  it('throws API error text from JSON payload for non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Bad request payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(get('/api/fail')).rejects.toThrow('Bad request payload');
  });

  it('throws fallback status text when error body is not json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Server exploded', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await expect(get('/api/oops')).rejects.toThrow('Request failed (500)');
  });

  it('clears auth and dispatches auth-expired on 401', async () => {
    localStorage.setItem('streamvault_jwt', 'jwt');
    localStorage.setItem('streamvault_user_key', 'user-key');
    localStorage.setItem('streamvault_user_profile', '{"email":"x@example.com"}');

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(get('/api/protected', 'jwt')).rejects.toThrow('Session expired');

    expect(localStorage.getItem('streamvault_jwt')).toBeNull();
    expect(localStorage.getItem('streamvault_user_key')).toBeNull();
    expect(localStorage.getItem('streamvault_user_profile')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect(dispatchSpy.mock.calls.some(([evt]) => evt.type === 'auth-expired')).toBe(true);
  });

  it('does not clear auth when silent401 is true', async () => {
    localStorage.setItem('streamvault_jwt', 'jwt');
    localStorage.setItem('streamvault_user_key', 'user-key');

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(get('/api/protected', 'jwt', { silent401: true })).rejects.toThrow('Session expired');

    expect(localStorage.getItem('streamvault_jwt')).toBe('jwt');
    expect(localStorage.getItem('streamvault_user_key')).toBe('user-key');
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
