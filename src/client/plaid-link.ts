const SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

interface PlaidHandler {
  open: () => void;
  destroy: () => void;
}

interface PlaidGlobal {
  create: (config: {
    token: string;
    onSuccess: (publicToken: string) => void;
    onExit: () => void;
  }) => PlaidHandler;
}

function plaid(): PlaidGlobal | undefined {
  return (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
}

function loadPlaid(): Promise<PlaidGlobal> {
  const ready = plaid();
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.onload = () => {
      const loaded = plaid();
      if (loaded) resolve(loaded);
      else reject(new Error('Plaid did not load'));
    };
    script.onerror = () => reject(new Error('Plaid did not load'));
    document.head.appendChild(script);
  });
}

/** Opens Plaid's own window, where the person signs in. Says nothing back but a token, or null if they closed it. */
export async function openPlaidLink(token: string): Promise<string | null> {
  const Plaid = await loadPlaid();
  return new Promise((resolve) => {
    const handler = Plaid.create({
      token,
      onSuccess: (publicToken) => {
        handler.destroy();
        resolve(publicToken);
      },
      onExit: () => {
        handler.destroy();
        resolve(null);
      },
    });
    handler.open();
  });
}
