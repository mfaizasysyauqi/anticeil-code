import { useCallback, useEffect, useState } from "react"

export type SessionGroup = {
	id: string
	name: string
	sessionIds: string[]
	collapsed: boolean
}

const STORAGE_KEY = "anticeil.sessionGroups"
const TITLES_STORAGE_KEY = "anticeil.sessionTitles"

function loadGroups(): SessionGroup[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		return JSON.parse(raw) as SessionGroup[]
	} catch {
		return []
	}
}

function saveGroups(groups: SessionGroup[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
	} catch {
		// quota exceeded or unavailable — silently ignore
	}
}

function loadCustomTitles(): Record<string, string> {
	try {
		const raw = localStorage.getItem(TITLES_STORAGE_KEY)
		if (!raw) return {}
		return JSON.parse(raw) as Record<string, string>
	} catch {
		return {}
	}
}

function saveCustomTitles(titles: Record<string, string>): void {
	try {
		localStorage.setItem(TITLES_STORAGE_KEY, JSON.stringify(titles))
	} catch {
		// quota exceeded or unavailable — silently ignore
	}
}

export function useSessionGroups() {
	const [groups, setGroups] = useState<SessionGroup[]>(loadGroups)
	const [customTitles, setCustomTitles] = useState<Record<string, string>>(loadCustomTitles)

	// Persist whenever groups or titles change
	useEffect(() => {
		saveGroups(groups)
	}, [groups])

	useEffect(() => {
		saveCustomTitles(customTitles)
	}, [customTitles])

	const createGroup = useCallback((name: string): string => {
		const id = `group-${Date.now()}`
		setGroups((prev) => [...prev, { id, name, sessionIds: [], collapsed: false }])
		return id
	}, [])

	const deleteGroup = useCallback((groupId: string) => {
		setGroups((prev) => prev.filter((g) => g.id !== groupId))
	}, [])

	const renameGroup = useCallback((groupId: string, name: string) => {
		setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)))
	}, [])

	const renameSession = useCallback((sessionId: string, newTitle: string) => {
		setCustomTitles((prev) => {
			const trimmed = newTitle.trim()
			if (!trimmed) {
				const next = { ...prev }
				delete next[sessionId]
				return next
			}
			return { ...prev, [sessionId]: trimmed }
		})
	}, [])

	const toggleGroupCollapsed = useCallback((groupId: string) => {
		setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)))
	}, [])

	/** Move a session into a group. Removes it from any previous group first. */
	const addToGroup = useCallback((sessionId: string, groupId: string) => {
		setGroups((prev) =>
			prev.map((g) => {
				if (g.id === groupId) {
					if (g.sessionIds.includes(sessionId)) return g
					return { ...g, sessionIds: [sessionId, ...g.sessionIds] }
				}
				// Remove from all other groups
				return { ...g, sessionIds: g.sessionIds.filter((id) => id !== sessionId) }
			}),
		)
	}, [])

	/** Remove a session from whichever group it belongs to. */
	const removeFromGroup = useCallback((sessionId: string) => {
		setGroups((prev) =>
			prev.map((g) => ({
				...g,
				sessionIds: g.sessionIds.filter((id) => id !== sessionId),
			})),
		)
	}, [])

	/** Return the group that contains this sessionId, or undefined. */
	const getGroupForSession = useCallback(
		(sessionId: string): SessionGroup | undefined => groups.find((g) => g.sessionIds.includes(sessionId)),
		[groups],
	)

	/** All session IDs that belong to any group */
	const groupedSessionIds = groups.flatMap((g) => g.sessionIds)

	return {
		groups,
		groupedSessionIds,
		customTitles,
		createGroup,
		deleteGroup,
		renameGroup,
		renameSession,
		toggleGroupCollapsed,
		addToGroup,
		removeFromGroup,
		getGroupForSession,
	}
}
