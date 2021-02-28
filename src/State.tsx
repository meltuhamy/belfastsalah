import React, { createContext, useReducer } from "react";
import { AppSettings } from "./lib/settings";
import { PrayerDayTimes, PrayerTime } from "./lib/PrayerTimes";
type State = {
  settings: { hydrated: boolean; value: AppSettings | null };
  tick: Date;
  currentTimes: {
    today: PrayerDayTimes | null;
    next: PrayerTime | null;
    prev: PrayerTime | null;
  };
};

const initialState: State = {
  settings: { hydrated: false, value: null },
  tick: new Date(),
  currentTimes: {
    today: null,
    next: null,
    prev: null
  }
};
const AppContext = createContext({
  state: { ...initialState },
  dispatch: (action: Action) => {}
});

type ActionType =
  | "setSettings"
  | "setTodayTimes"
  | "setNextPrayer"
  | "setPrevPrayer"
  | "setTick";

type Action = { type: ActionType; payload: any };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "setSettings": {
      return { ...state, settings: action.payload };
    }
    case "setTodayTimes": {
      return {
        ...state,
        currentTimes: { ...state.currentTimes, today: action.payload }
      };
    }
    case "setNextPrayer": {
      return {
        ...state,
        currentTimes: { ...state.currentTimes, next: action.payload }
      };
    }
    case "setPrevPrayer": {
      return {
        ...state,
        currentTimes: { ...state.currentTimes, prev: action.payload }
      };
    }
    case "setTick": {
      return { ...state, tick: new Date() };
    }
  }
  return state;
};

const AppContextProvider: React.FC = props => {
  const fullInitialState = {
    ...initialState
  };

  let [state, dispatch] = useReducer(reducer, fullInitialState);
  let value = { state, dispatch };

  return (
    <AppContext.Provider value={value}>{props.children}</AppContext.Provider>
  );
};

const AppContextConsumer = AppContext.Consumer;

export { AppContext, AppContextProvider, AppContextConsumer };
