import { BotBotContextProvider } from '../botbot';
import WolfAiShell from './WolfAiShell';

const WolfAiStandaloneApp = () => (
  <BotBotContextProvider userRole="Employee">
    <WolfAiShell />
  </BotBotContextProvider>
);

export default WolfAiStandaloneApp;
