import * as vscode from 'vscode';
import * as utils from '@shared/utils';
import {IconTheme, loadIconTheme} from './icon-theme';
import * as github from './github';

/*
const headersQL = {
	'Authorization': `Bearer ${token}`,
	'Content-Type': 'application/json',
};

const graphql	= new github.Fetcher(headersQL, 'https://api.github.com/graphql');
const repo0 	= await graphql.fetchGraphQL(
	`query($owner: String!, $repo: String!) {
		repository(owner: $owner, name: $repo) {
		name
		description
		}
	}`,
	{ owner, repo }
);
const contents0	= await graphql.fetchGraphQL(
	`query($owner: String!, $repo: String!) {
		repository(owner: $owner, name: $repo) {
			object(expression: "HEAD:") {
				... on Tree {
					entries {
						name
						type
						oid
						object {
							... on Blob {
								commitResourcePath
								commitUrl
							}
						}
					}
				}
			}
		}
	}`,
	{owner, repo}
);
*/

function timeSince(date: Date) {
	function plurals(n: number, s: string) {
		return Math.floor(n) + (n < 2 ? s : s + 's');
	}
	const seconds	= (Date.now() - date.getTime()) / 1000;
	const days		= seconds / (60 * 60 * 24);
	return	seconds < 60	? plurals(seconds,			" second")
		:	seconds < 3600	? plurals(seconds / 60,		" minute")
		:	days < 1		? plurals(seconds / 3600,	" hour")
		:	days < 7		? plurals(days,				" day")
		:	days < 30		? plurals(days / 7,			" week")
		:	days < 365		? plurals(days / 30,		" month")
		:	plurals(days / 365, " year");
}

class ReadOnlyDocumentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChange.event;

    async provideTextDocumentContent(uri: vscode.Uri) {
		const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });

		if (session) {
			const response = await fetch(uri.with({scheme: 'https'}).toString(), {
				headers: {
					'Authorization': `Bearer ${session.accessToken}`
				}
			});

			if (response.ok)
				return await response.text();
		} else {
			vscode.window.showErrorMessage('Failed to get authentication session');
		}
	}
}

class GithubView {
	panel: 	vscode.WebviewPanel;
	REST:	github.Fetcher;
	repo:	Promise<github.Repo>;
	icons:	Promise<IconTheme | undefined>;
	contents:	Record<string, github.Entry> = {};

	constructor(public context: vscode.ExtensionContext, owner: string, repo: string, token?: string) {
		const g 		= new github.Fetcher({
			'User-Agent': 'VSCode-Extension',
			'Accept': 'application/vnd.github.v3+json',
			'Authorization': `token ${token}`
		}, 'https://api.github.com');

		this.REST 		= g.sub('repos', owner, repo);
		this.repo 		= this.REST.fetch<github.Repo>();

		this.icons	= loadIconTheme().then(async icons => {
			if (icons) {
				const dest = vscode.Uri.joinPath(context.extensionUri, 'temp');
				await vscode.workspace.fs.createDirectory(dest);
				await icons.copyAssets(dest, true);
				return icons;
			}
		});
	
		this.panel = vscode.window.createWebviewPanel(
			'githubRepo',
			`${owner}/${repo}`,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		this.panel.webview.html =  `<!DOCTYPE html>` + JSX.render(<html lang="en">
			<head>
				<meta charset="UTF-8"/>
				<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
				<link rel="stylesheet" href={this.getUri("isopod/assets/shared.css")}/>
				</head>
			<body>
				<div class="loading-container">
					<div class="spinner"></div>
					<div class="loading-text">Loading repository...</div>
				</div>
			</body>
		</html>);


		this.getHtml('').then(html => this.panel.webview.html = html);
//		this.getHtml().then(html => this.panel.webview.html = html);

		this.panel.webview.onDidReceiveMessage(async (message: any) => {
			switch (message.command) {
				case 'select': {
					if (message.path !== undefined) {
						this.getHtml(message.path).then(html => this.panel.webview.html = html);
					} else {
						const entry = this.contents[message.text];
						if (entry) {
							if (entry.type === 'file') {
								const doc	= await vscode.workspace.openTextDocument(vscode.Uri.parse(entry.download_url).with({scheme: 'github-preview'}));
								vscode.window.showTextDocument(doc, { preview: false });
							} else {
								const url = vscode.Uri.parse(entry.url);
								const path = url.path.split('/').slice(5).join('/');
								this.getHtml(path).then(html => this.panel.webview.html = html);
							}
						} else {
							vscode.window.showErrorMessage(`Entry ${message.text} not found`);
						}
					}
					break;
				}
			}
		});
	}

	getUri(name: string) {
		return this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, name));
	}

	async getHtml(path: string) {
		try {
			const repo		= await this.repo;
			const icons	 	= await this.icons;
			const webview 	= this.panel.webview;


			const contents	= await this.REST.fetch<github.Entry[]>('contents', path);
			const commits	= await this.REST.fetchQuery<github.Commit[]>({path}, 'commits');
//			const branches	= await this.REST.fetch<github.Branch[]>('branches');
//			const pulls		= await this.REST.fetch<github.Pull[]>('pulls');

//			const commits   = await repo.commits();
//			const branches  = await repo.branches();
//			const pulls 	= await repo.pulls();

			const all_commits = await utils.asyncMap(contents, async i => 
				(i as any).lastCommit = await this.REST.fetchQuery<github.Commit[]>({path: `${path}/${i.name}`, per_page:1}, 'commits')
			);

			contents.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
			this.contents = Object.fromEntries(contents.map(a => [a.name, a]));

			return '<!DOCTYPE html>' + JSX.render(<html>
				<head>
					<meta charset="UTF-8"/>
					<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
					<meta http-equiv="Content-Security-Policy" content={`
						default-src ${webview.cspSource};
						style-src 	${webview.cspSource} 'unsafe-inline';
					`}/>
					<link rel="stylesheet" type="text/css" href={this.getUri('isopod/assets/shared.css')}/>
					<link rel="stylesheet" type="text/css" href={this.getUri('assets/github.css')}/>
					<style>
						{icons?.style(webview)}
					</style>
				</head>
			
				<body><div class="content">
					<div class="repo-header">
						<h1> {
							path.split(/[/\\]/).filter(Boolean)
							.reduce((paths: [string, string][], part: string) => {
								paths.push([part, paths.length ? `${paths.at(-1)?.[1]}/${part}` : part]);
								return paths;
							}, [[repo.full_name, '']])
							.map(([name, path]) => <>/<span class='select' data-path={path}>{name}</span></>)}
						</h1>
						<p>{repo.description || 'No description available'}</p>
					</div>

					<div class="stats">
						<div>⭐ {repo.stargazers_count} stars</div>
						<div>👀 {repo.watchers_count} watchers</div>
						<div>🔀 {repo.forks_count} forks</div>
					</div>

					<p>Default branch: {repo.default_branch}</p>
		
					<div class="repo-section">
						<h2>Contents</h2>
						<div class="repo-content">
							<ul>
								{contents.map(i => {
									const icon		= icons && icons.get_def(webview, (i.type === 'file' ? icons.getFileIcon(i.name) : icons.getFolderIcon(i.name)));
									const commit	= (i as any).lastCommit?.[0] as github.Commit;
									if (commit) {
										const since		= timeSince(new Date(commit.commit.committer.date));
										return <li>
											<span class="select" {...icon}>{i.name}</span>
											<span>{commit.commit.message}</span>
											<span>{since + " ago"}</span>
										</li>;
									} else {
										return <li>
											<span class="select" {...icon}>{i.name}</span>
										</li>;
									}
								})}
							</ul>
						</div>
					</div>
			
					<div class="repo-section">
						<h2>Commits</h2>
						<div class="repo-content">
							<ul>
								{commits.map(i => <li>{i.commit.message}</li>)}
							</ul>
						</div>
					</div>
			{/*
					<div class="repo-section">
						<h2>Branches</h2>
						<div class="repo-content">
							<ul>
								{branches.map(i => <li>{i.name}</li>)}
							</ul>
						</div>
					</div>
			
					<div class="repo-section">
						<h2>Pull Requests</h2>
						<div class="repo-content">
							<ul>
								{pulls.map(i => <li>{i.name}</li>)}
							</ul>
						</div>
					</div>
			*/}
					<p><a href="${info.html_url}">View on GitHub</a></p>
				</div>
				<script src={this.getUri("isopod/assets/shared.js")}></script>
				<script src={this.getUri("assets/github.js")}></script>
				</body>
			</html>);

		} catch (error: any) {
			return '<!DOCTYPE html>' + JSX.render(<html>
				<body>
					<div class="content">
						<h1>Error loading repository data</h1>
						<p>{error.message}</p>
					</div>
				</body>
			</html>);
		}

	}
}

//-----------------------------------------------------------------------------
//	main
//-----------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('github-preview', new ReadOnlyDocumentProvider()));


	context.subscriptions.push(vscode.commands.registerCommand('gitweb.openRepositoryUrl', async (sc: vscode.SourceControl) => {
		const root = sc.rootUri?.fsPath;
		if (!root) {
			vscode.window.showErrorMessage('No repository path found.');
			return;
		}
		try {
			const remoteUrl = await github.getRemoteUrl(root);
			
			if (remoteUrl) {
				const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
				if (!githubMatch) {
					vscode.env.openExternal(vscode.Uri.parse(remoteUrl));
					return;
				}

				const [, owner, repo] = githubMatch;
				const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
				new GithubView(context, owner, repo, session.accessToken);
				

			} else {
				vscode.window.showErrorMessage('No remote URL found.');
			}
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error: ${error.message}`);
		}
	}));
}