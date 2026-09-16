import { ClineMessage } from "@shared/ExtensionMessage"
import React, { memo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { highlightText } from "./Highlights"

interface StickyUserMessageProps {
	readonly lastUserMessage: ClineMessage | null
	readonly onScrollToMessage?: () => void
	readonly isVisible: boolean
	readonly mode?: string
}

/**
 * A sticky header component that displays the last user message
 * Shows when user scrolls down, allowing quick navigation back to their message
 */
export const StickyUserMessage: React.FC<StickyUserMessageProps> = memo(
	({ lastUserMessage, onScrollToMessage, isVisible, mode = "act" }) => {
		const handleClick = useCallback(() => {
			if (onScrollToMessage) {
				onScrollToMessage()
			}
		}, [onScrollToMessage])

		const handleKeyDown = useCallback(
			(e: React.KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					if (onScrollToMessage) {
						onScrollToMessage()
					}
				}
			},
			[onScrollToMessage],
		)

		// Don't render if no user message or not visible
		if (!lastUserMessage?.text || !isVisible) {
			return null
		}

		const messageText = lastUserMessage.text.trim()

		// Same colors as UserMessage bubble for visual consistency
		const isPlanMode = mode === "plan"
		const bubbleBg = isPlanMode ? "rgba(234, 179, 8, 0.12)" : "rgba(59, 130, 246, 0.12)"
		const bubbleBorder = isPlanMode ? "rgba(234, 179, 8, 0.3)" : "rgba(59, 130, 246, 0.3)"

		return (
			<div
				aria-label={`Scroll to your message: ${messageText}`}
				className={cn(
					"relative flex items-center px-2.5 pt-2 pb-2 cursor-pointer select-none",
					"backdrop-blur-sm rounded-sm",
					"hover:brightness-105 transition-all duration-150",
				)}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				role="button"
				style={{
					backgroundColor: bubbleBg,
					border: `1px solid ${bubbleBorder}`,
				}}
				tabIndex={0}
				title="Click to scroll to your message">
				{/* Message text (truncated via CSS text-ellipsis) */}
				<div
					className={cn(
						"flex-1 min-w-0 text-sm text-foreground",
						"overflow-hidden text-ellipsis whitespace-nowrap",
						"ph-no-capture",
					)}>
					{highlightText(messageText, false)}
				</div>
			</div>
		)
	},
	(prevProps, nextProps) => {
		return (
			prevProps.lastUserMessage?.ts === nextProps.lastUserMessage?.ts &&
			prevProps.lastUserMessage?.text === nextProps.lastUserMessage?.text &&
			prevProps.isVisible === nextProps.isVisible &&
			prevProps.mode === nextProps.mode
		)
	},
)

StickyUserMessage.displayName = "StickyUserMessage"
