import { ClineMessage } from "@shared/ExtensionMessage"
import React from "react"
import ContextWindow from "@/components/chat/task-header/ContextWindow"
import { MessageHandlers } from "../../types/chatTypes"

interface TaskSectionProps {
	task: ClineMessage
	apiMetrics: {
		totalTokensIn: number
		totalTokensOut: number
		totalCacheWrites?: number
		totalCacheReads?: number
		totalCost: number
	}
	lastApiReqTotalTokens?: number
	selectedModelInfo: {
		supportsPromptCache: boolean
		supportsImages: boolean
		contextWindow?: number
	}
	messageHandlers: MessageHandlers
}

/**
 * Task section shown when there's an active task
 * Includes the context window progress bar and compact button
 */
export const TaskSection: React.FC<TaskSectionProps> = ({
	apiMetrics,
	lastApiReqTotalTokens,
	selectedModelInfo,
	messageHandlers,
}) => {
	return (
		<div className="pt-2 pb-1 px-4 flex flex-col gap-1.5">
			<ContextWindow
				cacheReads={apiMetrics.totalCacheReads}
				cacheWrites={apiMetrics.totalCacheWrites}
				contextWindow={selectedModelInfo.contextWindow}
				lastApiReqTotalTokens={lastApiReqTotalTokens}
				onSendMessage={messageHandlers.handleSendMessage}
				tokensIn={apiMetrics.totalTokensIn}
				tokensOut={apiMetrics.totalTokensOut}
				useAutoCondense={false}
			/>
		</div>
	)
}
