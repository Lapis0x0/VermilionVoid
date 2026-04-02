import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';

interface SyncSettings {
	syncEndpoint: string;
	webhookSecret: string;
}

const DEFAULT_SETTINGS: SyncSettings = {
	syncEndpoint: 'http://localhost:3001/api/sync',
	webhookSecret: ''
}

/** Go 只注册 /api/sync，末尾多一个 / 会 404；只填 origin 时补全路径。 */
function normalizeSyncEndpoint(raw: string): string {
	const s = raw.trim();
	try {
		const u = new URL(s);
		if (u.pathname === '/' || u.pathname === '') {
			u.pathname = '/api/sync';
		}
		if (u.pathname.endsWith('/') && u.pathname.length > 1) {
			u.pathname = u.pathname.slice(0, -1);
		}
		return u.toString();
	} catch {
		return s;
	}
}

export default class SyncPlugin extends Plugin {
	settings!: SyncSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('refresh-cw', 'VermilionVoid: Trigger Sync', (evt: MouseEvent) => {
			this.triggerSync();
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'trigger-vermilion-void-sync',
			name: 'Trigger Blog Sync',
			callback: () => {
				this.triggerSync();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SyncSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async triggerSync() {
		if (!this.settings.syncEndpoint) {
			new Notice('Error: Sync endpoint is not configured in settings.');
			return;
		}

		new Notice('Sync starting...');

		try {
			const url = normalizeSyncEndpoint(this.settings.syncEndpoint);
			const response = await requestUrl({
				url,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.settings.webhookSecret}`
				}
			});

			if (response.status === 202 || response.status === 200) {
				new Notice('Sync successfully triggered! Go backend is processing.');
			} else {
				new Notice(`Sync failed (Status ${response.status}): ${response.text}`);
			}
		} catch (error) {
			console.error('VermilionVoid Sync Error:', error);
			new Notice(`Sync failed: ${(error as any).message}`);
		}
	}
}

class SyncSettingTab extends PluginSettingTab {
	plugin: SyncPlugin;

	constructor(app: App, plugin: SyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'VermilionVoid Sync Settings'});

		new Setting(containerEl)
			.setName('Sync Endpoint')
			.setDesc('The URL of your Go sync server /api/sync endpoint.')
			.addText(text => text
				.setPlaceholder('http://your-server:3001/api/sync')
				.setValue(this.plugin.settings.syncEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.syncEndpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Webhook Secret')
			.setDesc('The secret key (Bearer token) configured in your server\'s .env file.')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.webhookSecret)
				.onChange(async (value) => {
					this.plugin.settings.webhookSecret = value;
					await this.plugin.saveSettings();
				}));
	}
}
