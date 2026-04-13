import * as SecureStore from 'expo-secure-store';
import { fetch as expoFetch } from 'expo/fetch';

const originalFetch = fetch;
const authKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID}-jwt`;

const getURLFromArgs = (...args: Parameters<typeof fetch>) => {
  const [urlArg] = args;
  let url: string | null;
  if (typeof urlArg === 'string') {
    url = urlArg;
  } else if (typeof urlArg === 'object' && urlArg !== null) {
    url = urlArg.url;
  } else {
    url = null;
  }
  return url;
};

const isFileURL = (url: string) => {
  return url.startsWith('file://') || url.startsWith('data:');
};

const isFirstPartyURL = (url: string) => {
  const base = process.env.EXPO_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_APP_URL;
  return url.startsWith('/') || (!!base && url.startsWith(base));
};

const isSecondPartyURL = (url: string) => {
  return url.startsWith('/_create/');
};

type Params = Parameters<typeof expoFetch>;
const fetchToWeb = async function fetchWithHeaders(...args: Params) {
  const firstPartyURL =
    process.env.EXPO_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_APP_URL || '';
  const secondPartyURL = process.env.EXPO_PUBLIC_PROXY_BASE_URL;
  const [input, init] = args;
  const url = getURLFromArgs(input, init);
  if (!url) {
    return expoFetch(input, init);
  }

  if (isFileURL(url)) {
    return originalFetch(input, init);
  }

  const isExternalFetch = !isFirstPartyURL(url);
  // we should not add headers to requests that don't go to our own server
  if (isExternalFetch) {
    return expoFetch(input, init);
  }

  let finalInput = input;
  const baseURL = isSecondPartyURL(url) ? secondPartyURL : firstPartyURL;
  if (typeof input === 'string') {
    if (input.startsWith('/') && !baseURL) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[fetch] EXPO_PUBLIC_BASE_URL (or EXPO_PUBLIC_APP_URL) is missing; relative URLs cannot be resolved.',
        );
      }
      return expoFetch(input, init);
    }
    finalInput = input.startsWith('/') ? `${baseURL}${input}` : input;
  } else {
    return expoFetch(input, init);
  }

  const initHeaders = init?.headers ?? {};
  const finalHeaders = new Headers(initHeaders);

  const headers = {
    'x-createxyz-project-group-id': process.env.EXPO_PUBLIC_PROJECT_GROUP_ID,
    host: process.env.EXPO_PUBLIC_HOST,
    'x-forwarded-host': process.env.EXPO_PUBLIC_HOST,
    'x-createxyz-host': process.env.EXPO_PUBLIC_HOST,
  };

  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      finalHeaders.set(key, value);
    }
  }

  const auth = await SecureStore.getItemAsync(authKey)
    .then((auth) => {
      return auth ? JSON.parse(auth) : null;
    })
    .catch(() => {
      return null;
    });

  if (auth) {
    finalHeaders.set('authorization', `Bearer ${auth.jwt}`);
  }

  return expoFetch(finalInput, {
    ...init,
    headers: finalHeaders,
  });
};

export default fetchToWeb;
