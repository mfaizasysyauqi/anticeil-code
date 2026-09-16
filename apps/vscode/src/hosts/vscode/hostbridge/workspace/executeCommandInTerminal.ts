import path from "node:path"
import { ExecuteCommandInTerminalRequest, ExecuteCommandInTerminalResponse } from "@shared/proto/host/workspace"
import * as vscode from "vscode"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"

function getTerminalIcon(): vscode.Uri | vscode.ThemeIcon {
	try {
		if (HostProvider.isInitialized() && HostProvider.get().extensionFsPath) {
			return vscode.Uri.file(path.join(HostProvider.get().extensionFsPath, "assets", "icons", "anticeil-logo.svg"))
		}
	} catch {}
	return new vscode.ThemeIcon("terminal")
}

/**
 * Executes a command in a new terminal
 * @param request The request containing the command to execute
 * @returns Response indicating success
 */
export async function executeCommandInTerminal(
	request: ExecuteCommandInTerminalRequest,
): Promise<ExecuteCommandInTerminalResponse> {
	try {
		// Create terminal with fixed options
		const terminalOptions: vscode.TerminalOptions = {
			name: "Anticeil",
			iconPath: getTerminalIcon(),
			env: {
				ANTICEIL_ACTIVE: "true",
				CLINE_ACTIVE: "true",
			},
		}

		// Create a new terminal
		const terminal = vscode.window.createTerminal(terminalOptions)

		// Show the terminal to the user
		terminal.show()

		// Send the command to the terminal
		terminal.sendText(request.command, true)

		return ExecuteCommandInTerminalResponse.create({
			success: true,
		})
	} catch (error) {
		Logger.error("Error executing command in terminal:", error)
		return ExecuteCommandInTerminalResponse.create({
			success: false,
		})
	}
}
