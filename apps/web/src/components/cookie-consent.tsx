"use client";

import { CookieIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  type CookiePreferences,
  useCookieConsent,
} from "@/contexts/cookie-consent";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const { consent, preferences, acceptAll, declineAll, saveCustom, loaded } =
    useCookieConsent();

  const [customPrefs, setCustomPrefs] = useState<CookiePreferences>({
    analytics: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the canonical preferences into the editable draft state when the source changes
    setCustomPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    if (loaded && !consent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the banner once we know the user has no stored consent yet
      setIsVisible(true);
    }
  }, [loaded, consent]);

  useEffect(() => {
    const handleReopen = () => {
      setIsVisible(true);
      setShowCustomize(true);
    };
    window.addEventListener("reopen-cookie-consent", handleReopen);
    return () =>
      window.removeEventListener("reopen-cookie-consent", handleReopen);
  }, []);

  function handleAcceptAll() {
    acceptAll();
    setIsVisible(false);
  }

  function handleDeclineAll() {
    declineAll();
    setIsVisible(false);
  }

  function handleSaveCustom() {
    saveCustom(customPrefs);
    setIsVisible(false);
    setShowCustomize(false);
  }

  if (!isVisible) return null;

  return (
    <div className="animate-in slide-in-from-bottom-5 fixed right-0 bottom-0 left-0 z-80 p-4 sm:left-auto sm:max-w-md">
      <div className="rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg">
        <div className="flex gap-3">
          <div className="shrink-0">
            <CookieIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">We use cookies</p>
              <p className="text-xs text-muted-foreground">
                We use cookies to improve your browsing experience and analyze
                site traffic.
              </p>
            </div>

            {showCustomize && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Functional</p>
                    <p className="text-xs text-muted-foreground">
                      Required for the site to work properly (preferences,
                      region selection).
                    </p>
                  </div>
                  <Switch checked disabled />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Audience measurement</p>
                    <p className="text-xs text-muted-foreground">
                      Google Analytics, which sets cookies to help us understand
                      how the site is used. Anonymous, cookieless analytics
                      (Umami) stay on either way.
                    </p>
                  </div>
                  <Switch
                    checked={customPrefs.analytics}
                    onCheckedChange={(checked) =>
                      setCustomPrefs((prev) => ({
                        ...prev,
                        analytics: checked,
                      }))
                    }
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveCustom}
                  className="w-full"
                >
                  Save my choices
                </Button>
              </div>
            )}

            {!showCustomize && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeclineAll}
                  className="w-full sm:w-auto sm:flex-1"
                >
                  Decline all
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCustomize(true)}
                  className="w-full sm:w-auto sm:flex-1"
                >
                  Customize
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto sm:flex-1"
                >
                  Accept all
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
