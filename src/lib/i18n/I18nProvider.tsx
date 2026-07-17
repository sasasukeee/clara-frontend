"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { en, Dictionary } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";

export type Language = "en" | "tr";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

export const I18nProvider = ({ children, initialLanguage = "en" }: { children: React.ReactNode, initialLanguage?: Language }) => {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    // Try to restore from localStorage on client mount if available
    const stored = localStorage.getItem("app_language") as Language | null;
    if (stored === "en" || stored === "tr") {
      setLanguage(stored);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("app_language", lang);
  };

  const t = useMemo(() => (language === "tr" ? tr : en), [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
};
