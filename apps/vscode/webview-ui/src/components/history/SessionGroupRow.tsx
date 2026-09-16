import { HistoryItem } from "@shared/HistoryItem"
import type { TaskItem } from "@shared/proto/cline/task"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { memo, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SessionGroup } from "./useSessionGroups"
import HistoryViewItem from "./HistoryViewItem"

const PAGE_SIZE = 5

type Props = {
	group: SessionGroup
	allTasks: TaskItem[]
	selectedItems: string[]
	selectedGroups?: string[]
	pendingFavoriteToggles: Record<string, boolean>
	isSelectMode: boolean
	draggingId: string | null
	onToggleCollapsed: (groupId: string) => void
	onDelete: (groupId: string) => void
	onRename: (groupId: string, name: string) => void
	onRenameSession?: (sessionId: string, newTitle: string) => void
	onDrop: (sessionId: string, groupId: string) => void
	onDragStart: (sessionId: string) => void
	onDragEnd: () => void
	handleDeleteHistoryItem: (id: string) => void
	toggleFavorite: (id: string, isFavorited: boolean) => void
	handleHistorySelect: (itemId: string, checked: boolean) => void
	handleGroupSelect?: (groupId: string, checked: boolean) => void
}

const SessionGroupRow = ({
	group,
	allTasks,
	selectedItems,
	selectedGroups = [],
	pendingFavoriteToggles,
	isSelectMode,
	draggingId,
	onToggleCollapsed,
	onDelete,
	onDrop,
	onRename,
	onRenameSession,
	onDragStart,
	onDragEnd,
	handleDeleteHistoryItem,
	toggleFavorite,
	handleHistorySelect,
	handleGroupSelect,
}: Props) => {
	const [isDragOver, setIsDragOver] = useState(false)
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
	const [isRenaming, setIsRenaming] = useState(false)
	const [renameValue, setRenameValue] = useState(group.name)
	const inputRef = useRef<HTMLInputElement>(null)

	const isGroupChecked = useMemo(() => {
		if (selectedGroups.includes(group.id)) return true
		if (group.sessionIds.length > 0) {
			return group.sessionIds.every((id) => selectedItems.includes(id))
		}
		return false
	}, [selectedGroups, group.id, group.sessionIds, selectedItems])

	const sessionTasks = group.sessionIds
		.map((id) => allTasks.find((t) => t.id === id))
		.filter((t): t is TaskItem => !!t)

	const visibleTasks = sessionTasks.slice(0, visibleCount)
	const hasMore = sessionTasks.length > visibleCount

	const handleDragOver = (e: React.DragEvent) => {
		if (!draggingId) return
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		setIsDragOver(true)
	}

	const handleDragLeave = () => setIsDragOver(false)

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragOver(false)
		if (draggingId) {
			onDrop(draggingId, group.id)
		}
	}

	const commitRename = () => {
		const trimmed = renameValue.trim()
		if (trimmed && trimmed !== group.name) {
			onRename(group.id, trimmed)
		} else {
			setRenameValue(group.name)
		}
		setIsRenaming(false)
	}

	return (
		<div
			className={cn(
				"mb-1 rounded-sm border transition-colors",
				isDragOver
					? "border-button-background/60 bg-button-background/10"
					: "border-border-panel/30 bg-sidebar-background/40",
			)}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}>
			{/* Group header */}
			<div className="flex items-center gap-1 px-2 py-1.5 group/header">
				{isSelectMode && (
					<VSCodeCheckbox
						checked={isGroupChecked}
						className="mr-1 self-center"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							const checked = (e.target as HTMLInputElement).checked
							handleGroupSelect?.(group.id, checked)
						}}
					/>
				)}
				<button
					className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left"
					onClick={() => onToggleCollapsed(group.id)}
					type="button">
					{group.collapsed ? (
						<ChevronRightIcon className="shrink-0 text-description" size={13} />
					) : (
						<ChevronDownIcon className="shrink-0 text-description" size={13} />
					)}
					<FolderIcon className="shrink-0 text-description" size={13} />
					{isRenaming ? (
						<input
							autoFocus
							className="flex-1 min-w-0 bg-transparent border-b border-button-background outline-none text-xs py-0.5 text-foreground"
							onBlur={commitRename}
							onChange={(e) => setRenameValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitRename()
								if (e.key === "Escape") {
									setRenameValue(group.name)
									setIsRenaming(false)
								}
								e.stopPropagation()
							}}
							onClick={(e) => e.stopPropagation()}
							ref={inputRef}
							value={renameValue}
						/>
					) : (
						<span
							className="flex-1 min-w-0 text-xs font-medium truncate"
							onDoubleClick={(e) => {
								e.stopPropagation()
								setIsRenaming(true)
								setTimeout(() => inputRef.current?.select(), 0)
							}}>
							{group.name}
						</span>
					)}
					<span className="text-xs text-description ml-1 shrink-0">{sessionTasks.length}</span>
				</button>

				<div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
					<Button
						aria-label="Rename group"
						className="h-5 w-5 p-0"
						onClick={(e) => {
							e.stopPropagation()
							setIsRenaming(true)
							setTimeout(() => inputRef.current?.select(), 0)
						}}
						size="icon"
						variant="ghost">
						<PencilIcon size={11} />
					</Button>
					<Button
						aria-label="Delete group"
						className="h-5 w-5 p-0"
						onClick={(e) => {
							e.stopPropagation()
							onDelete(group.id)
						}}
						size="icon"
						variant="ghost">
						<Trash2Icon size={11} />
					</Button>
				</div>
			</div>

			{/* Sessions inside group */}
			{!group.collapsed && (
				<div className="pl-4 pb-1">
					{sessionTasks.length === 0 ? (
						<div className="px-3 py-2 text-xs text-description italic">
							Drop sessions here
						</div>
					) : (
						<>
							{visibleTasks.map((item, index) => (
								<HistoryViewItem
									handleDeleteHistoryItem={handleDeleteHistoryItem}
									handleHistorySelect={handleHistorySelect}
									index={index}
									isSelectMode={isSelectMode}
									item={item as unknown as HistoryItem}
									key={item.id}
									onDragEnd={onDragEnd}
									onDragStart={onDragStart}
									onRename={onRenameSession}
									pendingFavoriteToggles={pendingFavoriteToggles}
									selectedItems={selectedItems}
									toggleFavorite={toggleFavorite}
								/>
							))}
							{hasMore && (
								<button
									className="w-full text-xs text-description hover:text-foreground transition-colors py-1.5 text-center cursor-pointer"
									onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
									type="button">
									Load {Math.min(PAGE_SIZE, sessionTasks.length - visibleCount)} more
								</button>
							)}
						</>
					)}
				</div>
			)}
		</div>
	)
}

export default memo(SessionGroupRow)
