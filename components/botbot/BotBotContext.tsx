import React, { createContext, useContext, useState } from 'react';

export type PageContext = {
  pageName: string;
  module: string;
  userRole: string;
  keyMetricsVisible: string[];
  suggestedActions: string[];
};

type BotBotContextType = {
  pageContext: PageContext;
  setPageContext: (ctx: PageContext) => void;
};

const defaultContext: PageContext = {
  pageName: 'Dashboard',
  module: '',
  userRole: 'Employee',
  keyMetricsVisible: [],
  suggestedActions: [],
};

const BotBotContext = createContext<BotBotContextType>({
  pageContext: defaultContext,
  setPageContext: () => {},
});

export const BotBotContextProvider: React.FC<{
  children: React.ReactNode;
  userRole: string;
}> = ({ children, userRole }) => {
  const [pageContext, setPageContextState] = useState<PageContext>({
    ...defaultContext,
    userRole,
  });

  const setPageContext = (ctx: PageContext) => {
    setPageContextState({ ...ctx, userRole });
  };

  return (
    <BotBotContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </BotBotContext.Provider>
  );
};

export const useBotBotContext = () => useContext(BotBotContext);
