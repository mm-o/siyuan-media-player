import { Plugin, showMessage, openTab, Menu } from "siyuan";
import "@/styles/components.scss";
// @ts-ignore
import Player from "./components/Player.svelte";
// @ts-ignore
import PlayList from "./components/PlayList.svelte";
// @ts-ignore
import Setting from "./components/Setting.svelte";
// @ts-ignore
import Assistant from "./components/Assistant.svelte";

import type { ComponentInstance } from './core/types';

export default class MediaPlayerPlugin extends Plugin {
    private components = new Map<string, ComponentInstance>();
    private events = new Map<string, EventListener>();
    private linkClickHandler: ((e: MouseEvent) => Promise<void>) | null = null;
    private tabInstance: any = null;
    public playerAPI: any;

    /** 保存数据，支持格式化JSON */
    async saveData(f: string, d: any, i?: number) { return super.saveData(f, i !== undefined ? JSON.stringify(d, null, i) : d); }

    /** 获取插件配置 */
    private async getConfig() {
        const d = await this.loadData('config.json');
        return d && typeof d === 'object' && !Array.isArray(d) ? { settings: {}, ...d } : { settings: {} };
    }

    /** 插件加载初始化 */
    async onload() {
        await this.initAPI();
        this.registerEvents();
        this.addUI();
        setTimeout(() => document.querySelector('.dock__item[aria-label*="媒体播放器"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })), 100);
    }

    /** 插件卸载清理 */
    onunload() {
        this.events.forEach((handler, event) =>
            (event === 'linkClick' ? document : window).removeEventListener(event === 'linkClick' ? 'click' : event, handler, event === 'linkClick')
        );
        this.components.forEach(c => c?.$destroy?.());
        this.components.clear();
        this.events.clear();
        this.tabInstance = this.linkClickHandler = this.playerAPI = null;
        (window as any).siyuanMediaPlayer = null;
    }

    /** 初始化API和链接处理器 */
    private async initAPI() {
        const { createLinkClickHandler } = await import('./core/player');

        this.playerAPI = {
            getCurrentTime: () => this.components.get('player')?.getCurrentTime?.() || 0,
            seekTo: (time: number) => this.components.get('player')?.seekTo?.(time),
            getCurrentMedia: () => this.components.get('player')?.getCurrentMedia?.() || null
        };

        this.linkClickHandler = createLinkClickHandler(
            this.playerAPI,
            await this.getConfig(),
            () => this.openTab(),
            (item: any, startTime?: number, endTime?: number) => this.components.get('playlist')?.play?.(item, startTime, endTime)
        );
        document.addEventListener('click', this.linkClickHandler, true);
        this.events.set('linkClick', this.linkClickHandler);
    }

    /** 注册事件监听器和快捷键 */
    private registerEvents() {
        const handlers = {
            'siyuanMediaPlayerUpdate': (e: CustomEvent<any>) => {
                const { currentItem } = e.detail;
                if (this.tabInstance?.parent?.updateTitle && currentItem?.title) {
                    try { this.tabInstance.parent.updateTitle(currentItem.title); } catch {}
                }
                const assistant = this.components.get('assistant');
                if (assistant?.$set) assistant.$set({ currentMedia: currentItem });
            },
            'updatePlayerConfig': (e: CustomEvent) => {
                this.playerAPI?.updateConfig?.(e.detail);
            },
            'playMediaItem': (e: CustomEvent) => {
                if (this.playerAPI?.play) this.playerAPI.play(e.detail.url, e.detail);
            },
            'mediaPlayerTabChange': async (e: CustomEvent) => {
                const tabId = e.detail?.tabId;
                if (tabId) {
                    const container = document.querySelector('.media-player-sidebar-content');
                    if (container) await this.showTabContent(tabId, container as HTMLElement);
                }
            },
            'mediaPlayerAction': async (e: CustomEvent) => {
                const { action, loopStartTime } = e.detail;
                const currentItem = this.playerAPI?.getCurrentMedia?.();
                const config = await this.getConfig();

                if (!currentItem) return;

                try {
                    const { player, mediaNotes } = await import('./core/document');

                    switch (action) {
                        case 'screenshot':
                            await player.screenshot(this.playerAPI, currentItem, config, this.i18n);
                            break;
                        case 'timestamp':
                            await player.timestamp(this.playerAPI, currentItem, config, this.i18n);
                            break;
                        case 'loopSegment':
                            // loopStartTime存在说明是第二次点击，创建循环链接
                            if (loopStartTime !== undefined) {
                                await player.loop(this.playerAPI, currentItem, config, this.i18n, loopStartTime);
                            }
                            break;
                        case 'mediaNotes':
                            await mediaNotes.create(currentItem, config, this.playerAPI, this.i18n);
                            break;
                    }
                } catch (error) {
                    console.error(`执行${action}失败:`, error);
                    showMessage(`操作失败: ${error.message || error}`);
                }
            }
        };

        Object.entries(handlers).forEach(([event, handler]) => {
            const listener = handler.bind(this) as EventListener;
            this.events.set(event, listener);
            window.addEventListener(event, listener);
        });

        this.addHotkeys();
    }

    /** 添加侧边栏和顶栏UI */
    private addUI() {
        const iconId = 'siyuan-media-player-icon';
        const iconSvg = `<symbol id="${iconId}" viewBox="0 0 1024 1024"><path d="M753.265 105.112c12.57 12.546 12.696 32.81 0.377 45.512l-0.377 0.383-73.131 72.992L816 224c70.692 0 128 57.308 128 128v448c0 70.692-57.308 128-128 128H208c-70.692 0-128-57.308-128-128V352c0-70.692 57.308-128 128-128l136.078-0.001-73.13-72.992c-12.698-12.674-12.698-33.222 0-45.895 12.697-12.674 33.284-12.674 45.982 0l119.113 118.887h152.126l119.114-118.887c12.697-12.674 33.284-12.674 45.982 0zM457 440c-28.079 0-51 22.938-51 51v170c0 9.107 2.556 18.277 7 26 15.025 24.487 46.501 32.241 71 18l138-84c7.244-4.512 13.094-10.313 17-17 15.213-24.307 7.75-55.875-16-71l-139-85c-7.994-5.355-17.305-8-27-8z"/></symbol>`;

        this.addIcons(iconSvg);

        this.addDock({
            type: "SiyuanMediaSidebar",
            config: { position: "RightTop", size: { width: 400, height: 480 }, icon: iconId, title: this.i18n.sidebar?.title || "媒体播放器", show: true },
            data: { plugin: this },
            init: function() {
                const container = this.element;
                container.classList.add('media-player-sidebar');
                const contentEl = document.createElement('div');
                contentEl.className = 'media-player-sidebar-content';
                container.appendChild(contentEl);
                (this.data.plugin as MediaPlayerPlugin).showTabContent('playlist', contentEl);
            }
        });

        this.addTopBar({
            icon: `<svg viewBox="0 0 1024 1024"><path fill="#8b5cf6" d="M753.265 105.112c12.57 12.546 12.696 32.81 0.377 45.512l-0.377 0.383-73.131 72.992L816 224c70.692 0 128 57.308 128 128v448c0 70.692-57.308 128-128 128H208c-70.692 0-128-57.308-128-128V352c0-70.692 57.308-128 128-128l136.078-0.001-73.13-72.992c-12.698-12.674-12.698-33.222 0-45.895 12.697-12.674 33.284-12.674 45.982 0l119.113 118.887h152.126l119.114-118.887c12.697-12.674 33.284-12.674 45.982 0zM457 440c-28.079 0-51 22.938-51 51v170c0 9.107 2.556 18.277 7 26 15.025 24.487 46.501 32.241 71 18l138-84c7.244-4.512 13.094-10.313 17-17 15.213-24.307 7.75-55.875-16-71l-139-85c-7.994-5.355-17.305-8-27-8z"/></svg>`,
            title: this.i18n.name || '媒体播放器',
            position: 'right',
            callback: (event: MouseEvent) => {
                const menu = new Menu();
                menu.addItem({ icon: 'iconSettings', label: this.i18n.settings?.title || '设置', click: () => this.openSettings() });
                menu.open({ x: event.clientX, y: event.clientY });
            }
        });
    }

    /** 打开设置面板 */
    private openSettings() {
        const sidebar = document.querySelector('.dock__item[aria-label*="媒体播放器"]') as HTMLElement;
        if (sidebar) {
            sidebar.click();
            setTimeout(async () => {
                const container = document.querySelector('.media-player-sidebar-content') as HTMLElement;
                if (container) await this.showTabContent('settings', container);
            }, 100);
        }
    }

    /** 显示标签页内容，创建组件实例 */
    private async showTabContent(tabId: string, container: HTMLElement) {
        const components = { playlist: PlayList, assistant: Assistant, settings: Setting };

        container.querySelectorAll('[data-tab-id]').forEach(
            el => el.classList.toggle('fn__none', el.getAttribute('data-tab-id') !== tabId)
        );

        if (this.components.has(tabId)) {
            window.dispatchEvent(new CustomEvent('mediaPlayerTabActivate', { detail: { tabId } }));
            return;
        }

        const el = document.createElement('div');
        el.setAttribute('data-tab-id', tabId);
        container.appendChild(el);

        const component = components[tabId];
        if (!component) return;

        const baseProps = { config: await this.getConfig(), i18n: this.i18n, allTabs: ['playlist', 'assistant', 'settings'], activeTabId: tabId, api: this.playerAPI, plugin: this };
        const specificProps = {
            playlist: { currentItem: this.playerAPI?.getCurrentMedia?.() },
            settings: { group: 'media-player' },
            assistant: {
                player: this.playerAPI,
                currentMedia: this.playerAPI?.getCurrentMedia?.(),
                insertContentCallback: async (content: any) => {
                    const { doc } = await import('./core/document');
                    doc.insert(content, await this.getConfig(), this.i18n);
                },
                createTimestampLinkCallback: this.playerAPI.createTimestampLink
            }
        };

        const instance = new component({ target: el, props: { ...baseProps, ...specificProps[tabId] } });
        this.components.set(tabId, instance);

        if (tabId === 'playlist') {
            instance.$on?.('play', (event: CustomEvent<any>) => {
                this.openTab();
                setTimeout(() => window.dispatchEvent(new CustomEvent('playMediaItem', { detail: event.detail })), 300);
            });
        } else if (tabId === 'settings') {
            instance.$on?.('changed', (event: CustomEvent<any>) => {
                window.dispatchEvent(new CustomEvent('updatePlayerConfig', { detail: event.detail.settings }));
            });
        }

        window.dispatchEvent(new CustomEvent('mediaPlayerTabActivate', { detail: { tabId } }));
    }

    /** 打开播放器标签页 */
    private async openTab() {
        const config = await this.getConfig();
        const plugin = this;

        this.addTab({
            type: "custom_tab",
            init() {
                const container = document.createElement("div");
                container.className = "media-player-container";

                const playerArea = document.createElement("div");
                playerArea.className = "player-area";
                playerArea.style.cssText = "width:100%;height:100%;position:relative;z-index:1;";

                const mediaPlayerTab = document.createElement("div");
                mediaPlayerTab.className = "media-player-tab";
                mediaPlayerTab.appendChild(document.createElement("div")).className = "content-area";
                mediaPlayerTab.querySelector('.content-area').appendChild(playerArea);
                container.appendChild(mediaPlayerTab);

                plugin.tabInstance = this;
                plugin.components.set('player', new Player({
                    target: playerArea,
                    props: { config: config.settings, i18n: plugin.i18n, currentItem: plugin.playerAPI?.getCurrentMedia?.(), api: plugin.playerAPI }
                }));

                (window as any).siyuanMediaPlayer = plugin.playerAPI;
                window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', {
                    detail: { player: plugin.playerAPI, currentItem: plugin.playerAPI?.getCurrentMedia?.() }
                }));

                this.element.appendChild(container);
            },
            destroy() {
                const player = plugin.components.get('player');
                if (player?.$destroy) {
                    try { player.$destroy(); } catch (e) {}
                    plugin.components.delete('player');
                }
                plugin.tabInstance = null;
                (window as any).siyuanMediaPlayer = null;
            }
        });

        const openMode = config?.settings?.openMode || 'default';
        const tabOptions: any = {
            app: this.app,
            custom: { icon: "siyuan-media-player-icon", title: this.i18n.name, id: this.name + "custom_tab" }
        };

        if (openMode === 'right') tabOptions.position = 'right';
        else if (openMode === 'bottom') tabOptions.position = 'bottom';
        else if (openMode === 'window') tabOptions.custom.asWindow = true;

        openTab(tabOptions);
    }

    /** 添加快捷键命令 */
    private addHotkeys() {
        const actions = ['screenshot', 'timestamp', 'loopSegment', 'mediaNotes', 'openSidebar'];
        const texts = [this.i18n.screenshot?.text, this.i18n.timestamp?.text, this.i18n.loopSegment?.text, this.i18n.controlBar?.mediaNotes?.name, "打开媒体播放器面板"];

        actions.forEach((action, i) => this.addCommand({
            langKey: action,
            langText: texts[i] || action,
            hotkey: "",
            callback: () => {
                if (action === 'openSidebar') {
                    document.querySelector('.dock__item[aria-label*="媒体播放器"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    return;
                }

                if (!this.playerAPI?.getCurrentMedia?.()) {
                    showMessage(this.i18n.openPlayer);
                    this.openTab();
                    return;
                }

                this.playerAPI.triggerAction(action);
            }
        }));
    }


}
