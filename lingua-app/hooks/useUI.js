"use client";

import { createContext, useContext } from "react";
import { UI_TEXT } from "../config/uiText";

const UIContext=createContext({uiLang:"en",setUiLang:()=>{},t:UI_TEXT.en});

function useUI(){ return useContext(UIContext); }

export { UIContext, useUI };
