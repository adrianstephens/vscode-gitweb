/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import * as cp from 'child_process';

//-----------------------------------------------------------------------------
//	github API interfaces
//-----------------------------------------------------------------------------

export interface Node {
	sha:		string,
	url:		string,
}

export interface ParentNode extends Node {
	html_url: 	string,
}

export interface Branch {
	name:		string,
	commit: 	Node,
	protected:	boolean,
}

export interface Pull {
	name:		string,
}

export interface User {
	name:			string,
	email:			string,
	date:			string,
}

export interface UserDetails {
	login:				string,
	id:					number,
	node_id:			string,
	avatar_url:			string,
	gravatar_id:		string,
	url:				string,
	html_url:			string,
	followers_url:		string,
	following_url:		string,
	gists_url:			string,
	starred_url:		string,
	subscriptions_url:  string,
	organizations_url:  string,
	repos_url:			string,
	events_url:			string,
	received_events_url:string,
	type:			   	string,
	user_view_type:		string,
	site_admin:			boolean,
}

export interface Verification {
	verified:			boolean,
	reason: 			string,
	signature:			any,
	payload: 			any,
	verified_at:		any,
}
export interface Permissions {
	admin:   			boolean,
	maintain:			boolean,
	push:				boolean,
	triage:  			boolean,
	pull:				boolean,
}

export interface Entry extends ParentNode {
	name:			string,
	path:			string,
	size:			number,
	git_url:	 	string,
	download_url:	string,
	type:			"file"|"dir",
	_links: {
		self:	string,
		git: 	string,
		html:	string,
	},
}

export interface EntryDetail extends Entry {
	sha:		string,
	content:	string,
	encoding:   string,
}

export interface Commit extends ParentNode {
	node_id:	string,
	commit: {
		author:			User,
		committer:		User,
		message:		string,
		tree:			Node
		url: 			string,
		comment_count:	number,
		verification:	Verification
	},
	comments_url: 	string,
	author:			UserDetails,
	committer:		UserDetails,
	parents:		ParentNode[],
}

export interface Repo {
	id:								number,
	node_id:					   	string,
	name:						  	string,
	full_name:					 	string,
	private:					   	boolean,
	owner:						 	UserDetails,
	html_url:					  	string,
	description:				   	null,
	fork:						  	boolean,
	url:						   	string,
	forks_url:					 	string,
	keys_url:					  	string,
	collaborators_url:			 	string,
	teams_url:					 	string,
	hooks_url:					 	string,
	issue_events_url:			  	string,
	events_url:						string,
	assignees_url:				 	string,
	branches_url:				  	string,
	tags_url:					  	string,
	blobs_url:					 	string,
	git_tags_url:				  	string,
	git_refs_url:				  	string,
	trees_url:					 	string,
	statuses_url:				  	string,
	languages_url:				 	string,
	stargazers_url:					string,
	contributors_url:			  	string,
	subscribers_url:			   	string,
	subscription_url:			  	string,
	commits_url:				   	string,
	git_commits_url:			   	string,
	comments_url:				  	string,
	issue_comment_url:			 	string,
	contents_url:				  	string,
	compare_url:				   	string,
	merges_url:						string,
	archive_url:				   	string,
	downloads_url:				 	string,
	issues_url:						string,
	pulls_url:					 	string,
	milestones_url:					string,
	notifications_url:			 	string,
	labels_url:						string,
	releases_url:				  	string,
	deployments_url:			   	string,
	created_at:						string,
	updated_at:						string,
	pushed_at:					 	string,
	git_url:					   	string,
	ssh_url:					   	string,
	clone_url:					 	string,
	svn_url:					   	string,
	homepage:					  	null,
	size:						  	number,
	stargazers_count:			  	number,
	watchers_count:					number,
	language:					  	string,
	has_issues:						boolean,
	has_projects:				  	boolean,
	has_downloads:				 	boolean,
	has_wiki:					  	boolean,
	has_pages:					 	boolean,
	has_discussions:			   	boolean,
	forks_count:				   	number,
	mirror_url:						null,
	archived:					  	boolean,
	disabled:					  	boolean,
	open_issues_count:			 	number,
	license:					   	null,
	allow_forking:				 	boolean,
	is_template:				   	boolean,
	web_commit_signoff_required:   	boolean,
	topics:							any[],
	visibility:						string,
	forks:						 	number,
	open_issues:				   	number,
	watchers:					  	number,
	default_branch:					string,
	permissions:				   	Permissions,
	temp_clone_token:			  	string,
	allow_squash_merge:				boolean,
	allow_merge_commit:				boolean,
	allow_rebase_merge:				boolean,
	allow_auto_merge:			  	boolean,
	delete_branch_on_merge:			boolean,
	allow_update_branch:		   	boolean,
	use_squash_pr_title_as_default:	boolean,
	squash_merge_commit_message:   	string,
	squash_merge_commit_title:	 	string,
	merge_commit_message:		  	string,
	merge_commit_title:				string,
	network_count:				 	number,
	subscribers_count:			 	number,
}

//-----------------------------------------------------------------------------
//	fetch
//-----------------------------------------------------------------------------

export class Fetcher {
	constructor(public headers: Record<string, string>, public uri: string) {}
	async fetch<T = any>(...comps: string[]) : Promise<T> {
		return fetch([this.uri, ...comps].join('/'), {headers: this.headers}).then(res => res.json() as T);
	}
	async fetchQuery<T = any>(queries: Record<string, any>, ...comps: string[]) : Promise<T> {
		const query = Object.entries(queries)
			.filter(([_, v]) => v !== undefined)
			.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
			.join('&');
		return fetch([this.uri, ...comps].join('/') + (query && ('?' + query)), {headers: this.headers})
			.then(res => res.json() as T);
	}

	async fetchGraphQL<T = any>(query: string, variables: object) : Promise<T> {
		return fetch(this.uri, {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({query, variables}),
		}).then(res => res.json() as T);
	}
	
	sub(...comps: string[]) {
		return new Fetcher(this.headers, [this.uri, ...comps].join('/'));
	}
}

/*
export class REST extends Fetcher {
	constructor(headers: Record<string, string>) {
		super(headers, 'https://api.github.com');
	}
	async repo(owner: string, repo: string) {
		const fetcher = this.sub('repos', owner, repo);
		return new Repo(fetcher, await fetcher.fetch<Repo>());
	}
}
export class Repo implements Repo {
	constructor(public fetcher: Fetcher, data: Repo) {
		Object.assign(this, data);
	}
	async contents(...comps: string[]) 	{ return this.fetcher.fetch<Entry[]>('contents', ...comps); }
	async commits(path?: string, per_page?: number)		{ return this.fetcher.fetchQuery<Commit[]>({path, per_page}, 'commits'); }
	async branches()	{ return this.fetcher.fetch<Branch[]>('branches'); }
	async pulls()	 	{ return this.fetcher.fetch<Pull[]>('pulls'); }
}
*/
async function runCommand(command: string, cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		cp.exec(command, {cwd}, (error, stdout) => {
			if (error)
				reject(error);
			else
				resolve(stdout.trim());
		});
	});
}


export async function getRemoteUrl(root: string) {
	const branchName = await runCommand('git rev-parse --abbrev-ref HEAD', root);
	const remoteName = await runCommand(`git config branch.${branchName}.remote`, root);
	return runCommand(`git config remote.${remoteName}.url`, root);
}

//-----------------------------------------------------------------------------
// GraphQL
//-----------------------------------------------------------------------------

interface GraphQLResponse {
	data: {repository: {object: {entries: Array<{name: string; type: string; object: {commitResourcePath: string; commitUrl: string;};}>;};};};
}

interface CommitResponse {
	data: {repository: {object: {blame: {ranges: Array<{commit: {committedDate: string; message: string;};}>;};};};};
}
