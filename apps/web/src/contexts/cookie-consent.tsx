"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import STORAGE from "@/constants/storage";

type ConsentValue = "accepted" | "declined" | "custom" | null;

export type CookiePreferences = {
  analytics: boolean;
};

const DEFAULT_PREFERENCES: CookiePreferences = {
  analytics: false,
};

type CookieConsentContextValue = {
  consent: ConsentValue;
  preferences: CookiePreferences;
  setConsent: (value: ConsentValue) => void;
  setPreferences: (prefs: CookiePreferences) => void;
  acceptAll: () => void;
  declineAll: () => void;
  saveCustom: (prefs: CookiePreferences) => void;
  hasConsent: boolean;
  loaded: boolean;
};

const CookieConsentContext = createContext<
  CookieConsentContextValue | undefined
>(undefined);

function dispatchConsentEvent(value: string) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: STORAGE.LOCAL_STORAGE.COOKIE_CONSENT,
      newValue: value,
    }),
  );
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentValue>(null);
  const [loaded, setLoaded] = useState(false);
  const [preferences, setPreferencesState] =
    useState<CookiePreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE.LOCAL_STORAGE.COOKIE_CONSENT);
    const storedPrefs = localStorage.getItem(
      STORAGE.LOCAL_STORAGE.COOKIE_PREFERENCES,
    );
    if (stored === "accepted" || stored === "declined" || stored === "custom") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage on mount (no DOM API for it)
      setConsentState(stored);
    }
    if (storedPrefs) {
      try {
        setPreferencesState(JSON.parse(storedPrefs));
      } catch {
        // ignore invalid JSON
      }
    }
    setLoaded(true);
  }, []);

  function persistConsent(value: ConsentValue, prefs: CookiePreferences) {
    setConsentState(value);
    setPreferencesState(prefs);
    if (value) {
      localStorage.setItem(STORAGE.LOCAL_STORAGE.COOKIE_CONSENT, value);
      localStorage.setItem(
        STORAGE.LOCAL_STORAGE.COOKIE_PREFERENCES,
        JSON.stringify(prefs),
      );
      dispatchConsentEvent(value);
    }
  }

  function acceptAll() {
    persistConsent("accepted", { analytics: true });
  }

  function declineAll() {
    persistConsent("declined", { analytics: false });
  }

  function saveCustom(prefs: CookiePreferences) {
    const value = prefs.analytics ? "accepted" : "declined";
    persistConsent(value, prefs);
  }

  function setConsent(value: ConsentValue) {
    if (value === "accepted") {
      acceptAll();
    } else if (value === "declined") {
      declineAll();
    }
  }

  function setPreferences(prefs: CookiePreferences) {
    setPreferencesState(prefs);
  }

  const hasConsent = consent === "accepted" || consent === "custom";

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        preferences,
        setConsent,
        setPreferences,
        acceptAll,
        declineAll,
        saveCustom,
        hasConsent,
        loaded,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error(
      "useCookieConsent must be used within a CookieConsentProvider",
    );
  }
  return context;
}
