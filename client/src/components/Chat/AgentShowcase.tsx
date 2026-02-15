import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Constants,
  QueryKeys,
  EModelEndpoint,
  PermissionBits,
  dataService,
} from 'librechat-data-provider';
import type { TConversation, TPreset, Agent } from 'librechat-data-provider';
import { useChatContext, useAgentsMapContext } from '~/Providers';
import useDefaultConvo from '~/hooks/Conversations/useDefaultConvo';
import { useListAgentsQuery } from '~/data-provider';
import { getAgentAvatarUrl } from '~/utils/agents';
import { logger } from '~/utils';

/* ─── Agent card for the showcase ─── */
function AgentShowcaseCard({
  agent,
  onSelect,
}: {
  agent: Agent;
  onSelect: (agentId: string) => void;
}) {
  const avatarUrl = getAgentAvatarUrl(agent);

  return (
    <button
      onClick={() => onSelect(agent.id)}
      className="group relative flex w-36 flex-shrink-0 cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-border-light bg-surface-primary-alt px-3 pb-4 pt-4 shadow-sm transition-all duration-200 hover:border-border-medium hover:shadow-md hover:bg-surface-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-40"
      aria-label={`${agent.name ?? 'Agent'} auswählen`}
    >
      {/* Avatar */}
      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border-light bg-surface-secondary shadow-sm transition-transform duration-200 group-hover:scale-105 sm:h-16 sm:w-16">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${agent.name || 'Agent'}`}
            className="h-full w-full rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <Bot className="h-7 w-7 text-text-secondary sm:h-8 sm:w-8" strokeWidth={1.5} />
        )}
      </div>

      {/* Name */}
      <span className="line-clamp-1 w-full text-center text-sm font-medium text-text-primary">
        {agent.name ?? 'Agent'}
      </span>

      {/* Description */}
      {agent.description && (
        <span className="line-clamp-2 w-full text-center text-xs leading-relaxed text-text-secondary">
          {agent.description}
        </span>
      )}
    </button>
  );
}

/* ─── Scroll arrow button ─── */
function ScrollArrow({
  direction,
  onClick,
  visible,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const isLeft = direction === 'left';
  const Icon = isLeft ? ChevronLeft : ChevronRight;

  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-border-light bg-surface-primary p-1.5 shadow-md transition-all duration-200 hover:bg-surface-hover hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isLeft ? '-left-3 sm:-left-4' : '-right-3 sm:-right-4'
      }`}
      aria-label={isLeft ? 'Scroll left' : 'Scroll right'}
    >
      <Icon className="h-4 w-4 text-text-primary sm:h-5 sm:w-5" />
    </button>
  );
}

/* ─── Main showcase component ─── */
export default function AgentShowcase() {
  const queryClient = useQueryClient();
  const agentsMap = useAgentsMapContext();
  const { conversation, newConversation } = useChatContext();
  const getDefaultConversation = useDefaultConvo();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fetch agents list
  const { data: agentsList = null, isLoading } = useListAgentsQuery(
    { requiredPermission: PermissionBits.VIEW },
    {
      select: (res) => res.data,
    },
  );

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, agentsList]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const scrollAmount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  // Handle agent selection - mirrors useSelectAgent logic
  const updateConversation = useCallback(
    (agent: Partial<Agent>, template: Partial<TPreset | TConversation>) => {
      logger.log('conversation', 'Selecting agent from showcase', agent);
      const currentConvo = getDefaultConversation({
        conversation: { ...(conversation ?? {}), agent_id: agent.id },
        preset: template,
      });
      newConversation({
        template: currentConvo,
        preset: template as Partial<TPreset>,
        keepLatestMessage: true,
      });
    },
    [conversation, getDefaultConversation, newConversation],
  );

  const onSelectAgent = useCallback(
    async (agentId: string) => {
      const agent = agentsMap?.[agentId];
      if (!agent) {
        return;
      }

      const template: Partial<TPreset | TConversation> = {
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        conversationId: Constants.NEW_CONVO as string,
      };

      updateConversation({ id: agent.id }, template);

      // Fetch full agent data in the background
      try {
        const fullAgent = await queryClient.fetchQuery<Agent>(
          [QueryKeys.agent, agent.id],
          () => dataService.getAgentById({ agent_id: agent.id }),
          { staleTime: 1000 * 30 },
        );
        if (fullAgent) {
          updateConversation(fullAgent, { ...template, agent_id: fullAgent.id });
        }
      } catch (error) {
        if ((error as { silent: boolean } | undefined)?.silent) {
          return;
        }
        console.error('Error fetching full agent data:', error);
      }
    },
    [agentsMap, updateConversation, queryClient],
  );

  // Filter visible agents (those with names)
  const agents = useMemo(() => {
    if (!agentsList) {
      return [];
    }
    return agentsList.filter((a) => a.name);
  }, [agentsList]);

  // Don't render if no agents
  if (!agents.length && !isLoading) {
    return null;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="animate-fadeIn mx-auto w-full max-w-3xl px-4 pb-5 pt-2 xl:max-w-4xl">
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex w-36 flex-shrink-0 animate-pulse flex-col items-center gap-2.5 rounded-2xl border border-border-light bg-surface-primary-alt p-4 sm:w-40"
            >
              <div className="h-14 w-14 rounded-full bg-surface-secondary sm:h-16 sm:w-16" />
              <div className="h-4 w-20 rounded bg-surface-secondary" />
              <div className="h-3 w-24 rounded bg-surface-secondary" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn mx-auto w-full max-w-3xl px-4 pb-5 pt-2 xl:max-w-4xl">
      {/* Scroll container with arrows */}
      <div className="relative">
        <ScrollArrow
          direction="left"
          onClick={() => scroll('left')}
          visible={canScrollLeft}
        />

        <div
          ref={scrollRef}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pb-2 pt-1"
        >
          {agents.map((agent) => (
            <AgentShowcaseCard
              key={agent.id}
              agent={agent}
              onSelect={onSelectAgent}
            />
          ))}
        </div>

        <ScrollArrow
          direction="right"
          onClick={() => scroll('right')}
          visible={canScrollRight}
        />
      </div>
    </div>
  );
}
