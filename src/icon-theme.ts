import * as vscode from 'vscode';
import * as path from 'path';

//-----------------------------------------------------------------------------
//	file icons
//-----------------------------------------------------------------------------

interface ImageIcon {
	iconPath:		string;
}

interface FontIcon {
	fontCharacter:	string;
	fontColor?: 	string;
	fontSize?: 		number;
	fontId?: 		string;
}

interface FontSource {
	path:			string;
	format:			string;
}

interface Font {
	id: 			string,
	src: 			FontSource[]
	weight: 		string;
	style:			string;
	size: 			string;
}
  
interface ThemeData {
	iconDefinitions:	Record<string, ImageIcon | FontIcon>;
	fonts:				Font[];
	file:	                    string;
	folder:	                    string;
	folderExpanded:	            string;
	rootFolder:	                string;
	rootFolderExpanded:	        string;
	folderNames:	            Record<string, string>
	folderNamesExpanded:	    Record<string, string>
	rootFolderNames:	        Record<string, string>
	rootFolderNamesExpanded:	Record<string, string>
	languageIds:	            Record<string, string>
	fileExtensions:	            Record<string, string>
	fileNames:	                Record<string, string>
}

export function getLanguage(ext: string) {
	const ext2 = ext[0] == '.' ? ext.slice(1) : '.' + ext;
	for (const extension of vscode.extensions.all) {
		const languages	= extension.packageJSON.contributes?.languages;
		if (languages) {
			for (const lang of languages) {
				if (lang.extensions?.includes(ext) || lang.extensions?.includes(ext2))
					return lang.id;
			}
		}
	}
}

export class IconTheme {
	constructor(public themeFolder: vscode.Uri, public theme: ThemeData) {
		for (const def of Object.values(theme.iconDefinitions)) {
			if ('fontCharacter' in def)
				def.fontCharacter = String.fromCharCode(parseInt(def.fontCharacter.slice(1), 16));
		}
	}

	private getUri(webview: vscode.Webview, file: string) {
		return webview.asWebviewUri(vscode.Uri.file(path.join(this.themeFolder.fsPath, file)));
	}

	style(webview: vscode.Webview) {
		return this.theme.fonts ? this.theme.fonts.map(f =>
			`@font-face {
				font-family: '${f.id}';
				src: ${f.src.map(s => `url('${this.getUri(webview, s.path)}') format('${s.format}')`).join(', ')};
				font-weight: ${f.weight};
				font-style: ${f.style};
			}
			[font=${f.id}]::before {
				font-family: ${f.id};
				font-size: ${f.size};
			}
			`
		).join('\n') : '';
	}

	csp(webview: vscode.Webview) {
		return webview.asWebviewUri(this.themeFolder);
	}

	get_def(webview: vscode.Webview, icon?: string) {
		if (icon) {
			const def	= this.theme.iconDefinitions[icon];
			if (def) {
				if ('iconPath' in def)
					return {
						icon: this.getUri(webview, def.iconPath)
					};

				return {
					font: def.fontId || this.theme.fonts[0].id,
					icon: def.fontCharacter,
					...(def.fontColor ? {style: `--icon-color: ${def.fontColor}`} : {})
				};
			}
		}
	}

	getLanguageIcon(ext: string) : string | undefined {
		const lang = getLanguage(ext);
		return lang && this.theme.languageIds[lang];
	}

	getFileIcon(name: string) : string | undefined {
		let icon: string | undefined = this.theme.fileNames[name];
		if (!icon && (this.theme.fileExtensions || this.theme.languageIds)) {
			const exts	= name.split('.');
			while (!icon && exts.length > 1) {
				exts.shift();
				const ext = exts.join('.');
				if (this.theme.languageIds && (icon = this.getLanguageIcon(ext)))
					return icon;
				icon = this.theme.fileExtensions?.[ext];
			}
		}
		return icon || this.theme.file;
	}
	getFolderIcon(name: string, expanded = false) : string | undefined {
		return (expanded && this.theme.folderNamesExpanded?.[name])
			|| this.theme.folderNames?.[name]
			|| (expanded && this.theme.folderExpanded)
			|| this.theme.folder;
	}
	getRootFolderIcon(name: string, expanded = false) : string | undefined {
		return (expanded && this.theme.rootFolderNamesExpanded?.[name])
			|| this.theme.rootFolderNames?.[name]
			|| (expanded && this.theme.folderNamesExpanded?.[name])
			|| this.theme.folderNames?.[name]
			|| (expanded && this.theme.rootFolderExpanded)
			|| this.theme.rootFolder
			|| (expanded && this.theme.folderExpanded)
			|| this.theme.folder;
	}

	getFileIconForUri(uri: vscode.Uri) : string | undefined {
		const comps	= uri.fsPath.split(path.sep);
		const last	= comps.at(-1)!;
		let icon: string | undefined = this.theme.fileNames[comps.slice(-2).join('/')] || this.theme.fileNames[last];

		if (!icon && (this.theme.fileExtensions || this.theme.languageIds)) {
			const exts	= last.split('.');
			const dir	= comps.at(-2)!;
			while (!icon && exts.length > 1) {
				exts.shift();
				const ext = exts.join('.');
				if (this.theme.languageIds && (icon = this.getLanguageIcon(ext)))
					return icon;
				if (this.theme.fileExtensions)
					icon = this.theme.fileExtensions[ext] || this.theme.fileExtensions[`${dir}/${ext}`];
			}
		}
		return icon || this.theme.file;
	}
	getFolderIconForUri(uri: vscode.Uri, expanded = false, root?: vscode.Uri) : string | undefined {
		if (root && uri.fsPath.startsWith(root.fsPath))
			return this.getRootFolderIcon(root.fsPath.slice(root.fsPath.length), expanded);

		const comps	= uri.fsPath.split(path.sep);
		const last	= comps.at(-1)!;
		const last2	= comps.slice(-2).join('/');

		return (expanded ? this.theme.folderNamesExpanded?.[last2] : this.theme.folderNames?.[last2])
			|| this.getFolderIcon(last, expanded);
	}

	async copyAssets(dest: vscode.Uri, changeFolder = false) {
		const srce = this.themeFolder;
		function copy(name: string) {
			return vscode.workspace.fs.copy(
				vscode.Uri.joinPath(srce, name),
				vscode.Uri.joinPath(dest, name),
				{ overwrite: true }
			);
		}
	
		if (this.theme.iconDefinitions) {
			for (const def of Object.values(this.theme.iconDefinitions)) {
				if ('iconPath' in def)
					await copy(def.iconPath);
			}
		}
		if (this.theme.fonts) {
			for (const font of this.theme.fonts) {
				for (const src of font.src) {
					if (src.path)
						await copy(src.path);
				}
			}
		}
		if (changeFolder)
			this.themeFolder = dest;
	}
}

export function getIconTheme(id: string) {
	for (const extension of vscode.extensions.all) {
		const themes	= extension.packageJSON.contributes?.iconThemes;
		const theme		= themes && themes.find((theme: any) => theme.id === id);
		if (theme)
			return vscode.Uri.joinPath(extension.extensionUri, theme.path);
	}
}

export async function loadIconTheme() {
	const theme		= vscode.workspace.getConfiguration("workbench").get<string>("iconTheme");
	const source	= theme && getIconTheme(theme);
	if (source) {
		return new IconTheme(
			source.with({path: path.dirname(source.path)}),
			await vscode.workspace.fs.readFile(source).then(buffer => JSON.parse(buffer.toString()), () => ({}))
		);
	}
}


