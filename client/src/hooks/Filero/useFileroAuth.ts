import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Constants, QueryKeys, dataService } from 'librechat-data-provider';
import type { TAgentsMap } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useMCPToolsQuery } from '~/data-provider';
import useNewConvo from '~/hooks/useNewConvo';
import store from '~/store';

/**
 * Hook that monitors the current conversation and detects when FILERO
 * authentication is needed.
 *
 * FILERO is a SINGLE instance. The user authenticates once and credentials
 * are stored for ALL FILERO MCP servers. When switching agents, we check
 * the global FILERO auth status (does ANY server have creds?), not per-agent.
 */
export default function useFileroAuth(agentsMap: TAgentsMap | undefined) {
  const [showModal, setShowModal] = useRecoilState(store.showFileroLogin);
  const lastCheckedAgentId = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const { newConversation } = useNewConvo();

  // Watch conversation state (index 0 is the primary conversation)
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const agentId = conversation?.agent_id ?? null;

  // Get MCP tools data using the app's existing query (shares cache with useAppStartup)
  const { data: mcpToolsData } = useMCPToolsQuery();

  // Discover ALL FILERO server names from MCP tools config
  const allFileroServers = useMemo(() => {
    if (!mcpToolsData?.servers) {
      return [];
    }
    return Object.entries(mcpToolsData.servers)
      .filter(([, server]) => server?.isFilero)
      .map(([name]) => name);
  }, [mcpToolsData]);

  /**
   * Determine if the current agent uses ANY FILERO tool.
   */
  const agentUsesFilero = useMemo(() => {
    if (!agentId || !agentsMap || !mcpToolsData?.servers) {
      return false;
    }
    const agent = agentsMap[agentId];
    if (!agent?.tools || agent.tools.length === 0) {
      return false;
    }
    for (const toolId of agent.tools) {
      const delimiterIdx = toolId.indexOf(Constants.mcp_delimiter);
      if (delimiterIdx === -1) {
        continue;
      }
      const serverName = toolId.slice(delimiterIdx + Constants.mcp_delimiter.length);
      const server = mcpToolsData.servers[serverName];
      if (server?.isFilero) {
        return true;
      }
    }
    return false;
  }, [agentId, agentsMap, mcpToolsData]);

  /**
   * Main effect: When agent_id changes and agent uses FILERO tools,
   * check if user has FILERO credentials (globally, not per-server).
   */
  useEffect(() => {
    // No agent selected — reset
    if (!agentId) {
      lastCheckedAgentId.current = null;
      return;
    }

    // Already checked this agent
    if (agentId === lastCheckedAgentId.current) {
      return;
    }

    // Need data to do lookups
    if (!agentsMap || !mcpToolsData?.servers) {
      return;
    }

    // Mark as checked
    lastCheckedAgentId.current = agentId;

    // Agent doesn't use FILERO tools — no auth needed
    if (!agentUsesFilero) {
      return;
    }

    // Agent uses FILERO tools! Check global auth status.
    dataService
      .getFileroAuthStatus()
      .then((status) => {
        // authenticated = true means at least ONE FILERO server has creds
        if (!status?.authenticated) {
          setShowModal(true);
        }
      })
      .catch(() => {
        // On error, show modal to be safe
        setShowModal(true);
      });
  }, [agentId, agentsMap, mcpToolsData, agentUsesFilero]);

  const onSuccess = useCallback(() => {
    setShowModal(false);
    lastCheckedAgentId.current = null; // Reset so next agent check works
    queryClient.invalidateQueries([QueryKeys.fileroAuthStatus]);
    queryClient.invalidateQueries([QueryKeys.mcpAuthValues]);
    queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);
  }, [queryClient]);

  const onCancel = useCallback(() => {
    setShowModal(false);
    // Switch back to the default assistant (new conversation without agent)
    newConversation({});
    navigate('/c/new', { replace: true });
    showToast({
      message: 'FILERO-Zugang erforderlich. Bitte melden Sie sich zuerst an.',
      status: 'warning',
    });
  }, [newConversation, navigate, showToast]);

  return {
    showModal,
    /** All FILERO server names discovered from MCP config */
    allFileroServers,
    onSuccess,
    onCancel,
    setShowModal,
  };
}
