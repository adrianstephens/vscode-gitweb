import * as vscode from 'vscode';
import * as cp from 'child_process';

async function runCommand(command: string, cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		cp.exec(command, { cwd }, (error, stdout) => {
			if (error)
				reject(error);
			else
				resolve(stdout.trim());
		});
	});
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('gitweb.openRepositoryUrl', async (sc: vscode.SourceControl) => {
		const root = sc.rootUri?.fsPath;
		if (!root) {
			vscode.window.showErrorMessage('No repository path found.');
			return;
		}
		try {
			const branchName	= await runCommand('git rev-parse --abbrev-ref HEAD', root);
			const remoteName	= await runCommand(`git config branch.${branchName}.remote`, root);
			const remoteUrl		= await runCommand(`git config remote.${remoteName}.url`, root);
			if (remoteUrl) {
				vscode.env.openExternal(vscode.Uri.parse(remoteUrl));
			} else {
				vscode.window.showErrorMessage('No remote URL found.');
			}
		} catch (error:any) {
			vscode.window.showErrorMessage(`Error: ${error.message}`);
		}
	}));
}
