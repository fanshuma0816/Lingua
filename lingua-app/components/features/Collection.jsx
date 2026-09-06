"use client";

import { useEffect, useState } from "react";
import { Say, Svg } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { fetchCollection } from "../../lib/collection";
import { meaningParts } from "../../lib/text";

function CollectionEmpty({ signedIn, tab, onLogin, onStartLearning }) {
  const { t } = useUI();
  const copy = tab === "grammar" ? t.collection.emptyGrammar : t.collection.emptyWords;
  return (
    <div className="empty-state">
      <div className="empty-icon"><Svg n="collection" /></div>
      <h2>{signedIn ? copy.title : t.collection.signInTitle}</h2>
      <p>{signedIn ? copy.body : t.collection.signInBody}</p>
      <div className="empty-actions">
        {!signedIn && <button className="btn btn-primary focusable" onClick={onLogin}><Svg n="user" /> {t.authPrompt.signIn}</button>}
        <button className="btn btn-outline focusable" onClick={onStartLearning}>{t.progress.startLearning}</button>
      </div>
    </div>
  );
}

function WordCard({ item }) {
  const { t } = useUI();
  const parts = meaningParts(item);
  return (
    <div className="wcard collection-word-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row" style={{ gap: 9 }}>
          <b className="notranslate" translate="no" lang={item.lang === "Dutch" ? "nl" : undefined} style={{ fontSize: 15 }}>{item.word}</b>
          {item.pos && <span className="badge badge-outline">{item.pos}</span>}
        </span>
        <span className="row" style={{ gap: 8 }}>
          <span className="saved-pill"><Svg n="bookmarkCheck" /> {t.collection.saved}</span>
          <Say text={item.word} lang={item.lang} rate={1} />
        </span>
      </div>
      {parts.simple && <div className="meaning-block"><div className="meaning-simple">{parts.simple}</div></div>}
      {parts.detail && <div className="summary-detail collection-word-detail">{parts.detail}</div>}
      {item.example && <div className="word-example notranslate" translate="no" lang={item.lang === "Dutch" ? "nl" : undefined}>“{item.example}”</div>}
      {item.exampleTranslation && <div className="word-example-translation">→ {item.exampleTranslation}</div>}
    </div>
  );
}

function GrammarCard({ item }) {
  const { t } = useUI();
  return (
    <div className="grammar-card collection-grammar-card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <b>{item.title}</b>
          {item.explanation && <p>{item.explanation}</p>}
        </div>
        <span className="saved-pill"><Svg n="bookmarkCheck" /> {t.collection.saved}</span>
      </div>
      {(item.example || item.example_translation) && <div className="grammar-examples">
        <div className="grammar-example-row">
          {item.example && <div className="grammar-example notranslate" translate="no" lang={item.lang === "Dutch" ? "nl" : undefined}>{item.example}</div>}
          {item.example_translation && <div className="grammar-example-translation">→ {item.example_translation}</div>}
        </div>
      </div>}
    </div>
  );
}

function Collection({ auth, tab = "words", onTabChange, onLogin, onStartLearning }) {
  const { t } = useUI();
  const signedIn = !!auth?.session?.accessToken;
  const active = tab === "grammar" ? "grammar" : "words";
  const [state, setState] = useState({ loading: false, error: "", words: [], grammar: [] });
  const [language, setLanguage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!signedIn) {
        setState({ loading: false, error: "", words: [], grammar: [] });
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const data = await fetchCollection(auth.session.accessToken);
        if (!cancelled) setState({ loading: false, error: "", words: data.words || [], grammar: data.grammar || [] });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e?.message || t.collection.loadError, words: [], grammar: [] });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [signedIn, auth?.session?.accessToken]);

  const languages = [...new Set([...(state.words || []), ...(state.grammar || [])].map((item) => item.lang).filter(Boolean))];
  useEffect(() => {
    if (!languages.length) setLanguage("");
    else if (!language || !languages.includes(language)) setLanguage(languages[0]);
  }, [languages.join("|"), language]);
  const allItems = active === "grammar" ? state.grammar : state.words;
  const items = languages.length > 1 && language ? allItems.filter((item) => item.lang === language) : allItems;

  return (
    <div className="account-page">
      <div className="page-head">
        <h1>{t.collection.title}</h1>
        <p className="sub">{t.collection.subtitle}</p>
      </div>

      <div className="tabs collection-tabs">
        <button className={"tab" + (active === "words" ? " on" : "")} onClick={() => onTabChange?.("words")}>{t.collection.wordsTab}</button>
        <button className={"tab" + (active === "grammar" ? " on" : "")} onClick={() => onTabChange?.("grammar")}>{t.collection.grammarTab}</button>
      </div>
      {signedIn && languages.length > 1 && <div className="tabs language-tabs">
        {languages.map((lang) => <button className={"tab" + (language === lang ? " on" : "")} onClick={() => setLanguage(lang)} key={lang}>{lang}</button>)}
      </div>}

      {!signedIn && <CollectionEmpty signedIn={false} tab={active} onLogin={onLogin} onStartLearning={onStartLearning} />}
      {signedIn && state.loading && <div className="card card-p">{t.collection.loading}</div>}
      {signedIn && state.error && <div className="notice">{state.error}</div>}
      {signedIn && !state.loading && !state.error && !items.length && <CollectionEmpty signedIn tab={active} onLogin={onLogin} onStartLearning={onStartLearning} />}
      {signedIn && !state.loading && !state.error && !!items.length && <div className="collection-list">
        {active === "grammar"
          ? items.map((item) => <GrammarCard key={item.id} item={item} />)
          : items.map((item) => <WordCard key={item.id || `${item.lang}-${item.word}`} item={item} />)}
      </div>}
    </div>
  );
}

export { Collection };
