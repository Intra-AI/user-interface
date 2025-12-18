import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Declare global ZammadChat type
declare global {
  interface Window {
    ZammadChat?: any;
  }
}

type ChatState = 'offline' | 'online' | 'connecting' | 'unsupported' | 'initializing';

interface ZammadChatContextType {
  chatInstance: any | null;
  isAgentAvailable: boolean;
  chatState: ChatState;
  openChat: () => void;
  closeChat: () => void;
}

const ZammadChatContext = createContext<ZammadChatContextType | undefined>(undefined);

interface ZammadChatProviderProps {
  children: React.ReactNode;
}

export function ZammadChatProvider({ children }: ZammadChatProviderProps) {
  const [chatInstance, setChatInstance] = useState<any>(null);
  const [chatState, setChatState] = useState<ChatState>('initializing');
  const [isAgentAvailable, setIsAgentAvailable] = useState(false);

  useEffect(() => {
    // Wait for ZammadChat to be loaded
    const initializeChat = () => {
      if (typeof window.ZammadChat !== 'undefined') {
        try {
          const instance = new window.ZammadChat({
            title: '<strong>Chat</strong> with us!',
            fontSize: '13px',
            chatId: 1,
            show: false, // Don't show automatically
            onReady: () => {
              console.log('Zammad Chat is ready');
              // Check initial state
              if (instance.state) {
                setChatState(instance.state);
                setIsAgentAvailable(instance.state === 'online');
              }
            },
            onConnectionEstablished: () => {
              console.log('Zammad Chat connection established');
            },
            onError: (error: any) => {
              console.error('Zammad Chat error:', error);
              setChatState('offline');
              setIsAgentAvailable(false);
            },
          });

          setChatInstance(instance);

          // Poll for state changes (since there's no direct availability change event)
          const stateCheckInterval = setInterval(() => {
            if (instance.state) {
              setChatState(instance.state);
              setIsAgentAvailable(instance.state === 'online');
            }
          }, 5000); // Check every 5 seconds

          return () => clearInterval(stateCheckInterval);
        } catch (error) {
          console.error('Failed to initialize Zammad Chat:', error);
          setChatState('unsupported');
        }
      } else {
        console.warn('ZammadChat is not available yet, retrying...');
        setTimeout(initializeChat, 500);
      }
    };

    // Delay initialization to ensure script is loaded
    const timeoutId = setTimeout(initializeChat, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  const openChat = useCallback(() => {
    if (chatInstance && typeof chatInstance.open === 'function') {
      chatInstance.open();
    } else {
      console.warn('Chat instance not ready or open method not available');
    }
  }, [chatInstance]);

  const closeChat = useCallback(() => {
    if (chatInstance && typeof chatInstance.close === 'function') {
      chatInstance.close();
    }
  }, [chatInstance]);

  const value = {
    chatInstance,
    isAgentAvailable,
    chatState,
    openChat,
    closeChat,
  };

  return <ZammadChatContext.Provider value={value}>{children}</ZammadChatContext.Provider>;
}

export function useZammadChat() {
  const context = useContext(ZammadChatContext);
  if (context === undefined) {
    throw new Error('useZammadChat must be used within a ZammadChatProvider');
  }
  return context;
}
