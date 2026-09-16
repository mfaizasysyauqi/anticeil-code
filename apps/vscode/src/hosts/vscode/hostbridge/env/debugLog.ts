import { Empty, StringRequest } from "@shared/proto/cline/common"
import * as vscode from "vscode"

const ANTICEIL_OUTPUT_CHANNEL = vscode.window.createOutputChannel("Anticeil")

// Appends a log message to all Anticeil output channels.
export async function debugLog(request: StringRequest): Promise<Empty> {
	ANTICEIL_OUTPUT_CHANNEL.appendLine(request.value)
	return Empty.create({})
}

// Register the Anticeil output channel within the VSCode extension context.
export function registerClineOutputChannel(context: vscode.ExtensionContext): vscode.OutputChannel {
	context.subscriptions.push(ANTICEIL_OUTPUT_CHANNEL)
	return ANTICEIL_OUTPUT_CHANNEL
}
