import { Plugin, showMessage, openTab, Menu, Dialog } from "siyuan";
import "@/styles/components.scss";

// @ts-ignore
import Player from "./components/Player.svelte";
// @ts-ignore
import PlayList from "./components/PlayList.svelte";
// @ts-ignore
import Setting from "./components/Setting.svelte";
// @ts-ignore
import Assistant from "./components/Assistant.svelte";
import { MediaHandler } from './core/PlayList';
import type { ComponentInstance } from './core/types';
import { createMediaPlayerAPI } from './api';

/**
 * 思源笔记媒体播放器插件
 */
export default class MediaPlayerPlugin extends Plugin {
    private components = new Map<string, ComponentInstance>();
    private events = new Map<string, EventListener>();
    private mediaHandler: MediaHandler | null = null;
    private tabInstance: any = null;
    public api: any;
    public playerAPI: any;
    
    // 配置管理
    private getConfig() {
        try { 
            const workspace = window.siyuan.config.system.workspaceDir;
            return JSON.parse(window.require('fs').readFileSync(`${workspace}/data/storage/petal/siyuan-media-player/config.json`, 'utf-8'));
        } catch { 
            return { settings: {}, bilibiliLogin: undefined }; 
        } 
    }
    
    // 插件初始化
    async onload() {
        this.initAPI();
        this.registerUIEvents();
        this.registerHotkeys();
        this.addSidebar();
        this.addTopBarButton();
        this.loadUserScripts();
    }
    
    // 插件清理
    onunload() {
        this.mediaHandler?.cleanup();
        this.events.forEach((handler, event) => window.removeEventListener(event, handler));
        this.components.forEach(component => { if (component?.$destroy) try { component.$destroy(); } catch (e) {} });
        this.components.clear();
        this.tabInstance = this.mediaHandler = this.playerAPI = null;
        (window as any).siyuanMediaPlayer = null;
        document.querySelectorAll('[id^="media-player-script-"]').forEach(el => el.remove());
    }
    
    // API初始化
    private initAPI() {        
        this.mediaHandler = new MediaHandler({
            getConfig: () => this.getConfig(),
            openTab: () => this.openTab(),
            waitForElement: (selector: string, timeout?: number) => this.waitForElement(selector, timeout),
            components: this.components,
            i18n: this.i18n
        });
        
        this.playerAPI = this.mediaHandler.getPlayerAPI();
        this.api = createMediaPlayerAPI(this.name, () => this.openTab());
    }
    
    // UI事件注册
    private registerUIEvents() {
        const handlers = {
            'siyuanMediaPlayerUpdate': (e: CustomEvent<any>) => {
                const { currentItem } = e.detail;
                this.mediaHandler?.setCurrentItem(currentItem);
                
                if (this.tabInstance?.parent?.updateTitle && currentItem?.title) {
                    try { this.tabInstance.parent.updateTitle(currentItem.title); } catch {}
                }
                
                const assistant = this.components.get('assistant');
                if (assistant?.$set) assistant.$set({ currentMedia: currentItem });
            },
            
            'updatePlayerConfig': (e: CustomEvent) => {
                this.playerAPI?.updateConfig?.(e.detail);
                this.loadUserScripts();
            },
            
            'mediaPlayerTabChange': (e: CustomEvent) => {
                const tabId = e.detail?.tabId;
                if (tabId) {
                    const container = document.querySelector('.media-player-sidebar-content');
                    if (container) this.showTabContent(tabId, container as HTMLElement);
                }
            },
            
            'reloadUserScripts': () => this.loadUserScripts()
        };
        
        Object.entries(handlers).forEach(([event, handler]) => {
            const listener = handler.bind(this) as EventListener;
            this.events.set(event, listener);
            window.addEventListener(event, listener);
        });
    }
    
    // 侧边栏UI
    private addSidebar() {
        const iconId = 'siyuan-media-player-icon';
        this.addIcons(`<symbol id="${iconId}" viewBox="0 0 1024 1024"><path d="M753.265 105.112c12.57 12.546 12.696 32.81 0.377 45.512l-0.377 0.383-73.131 72.992L816 224c70.692 0 128 57.308 128 128v448c0 70.692-57.308 128-128 128H208c-70.692 0-128-57.308-128-128V352c0-70.692 57.308-128 128-128l136.078-0.001-73.13-72.992c-12.698-12.674-12.698-33.222 0-45.895 12.697-12.674 33.284-12.674 45.982 0l119.113 118.887h152.126l119.114-118.887c12.697-12.674 33.284-12.674 45.982 0zM457 440c-28.079 0-51 22.938-51 51v170c0 9.107 2.556 18.277 7 26 15.025 24.487 46.501 32.241 71 18l138-84c7.244-4.512 13.094-10.313 17-17 15.213-24.307 7.75-55.875-16-71l-139-85c-7.994-5.355-17.305-8-27-8z"/></symbol>`);
        
        this.addDock({
            type: "SiyuanMediaSidebar",
            config: { position: "RightTop", size: { width: 400, height: 480 }, icon: iconId, title: (this.i18n.sidebar?.title || "媒体播放器") + (this.commands?.find(cmd => cmd.langKey === "openSidebar")?.hotkey ? " " + this.commands.find(cmd => cmd.langKey === "openSidebar").hotkey : "") },
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
    }
    
    // 顶栏按钮
    private addTopBarButton() {
        this.addTopBar({
            icon: `<svg viewBox="0 0 1024 1024"><path fill="#8b5cf6" d="M753.265 105.112c12.57 12.546 12.696 32.81 0.377 45.512l-0.377 0.383-73.131 72.992L816 224c70.692 0 128 57.308 128 128v448c0 70.692-57.308 128-128 128H208c-70.692 0-128-57.308-128-128V352c0-70.692 57.308-128 128-128l136.078-0.001-73.13-72.992c-12.698-12.674-12.698-33.222 0-45.895 12.697-12.674 33.284-12.674 45.982 0l119.113 118.887h152.126l119.114-118.887c12.697-12.674 33.284-12.674 45.982 0zM457 440c-28.079 0-51 22.938-51 51v170c0 9.107 2.556 18.277 7 26 15.025 24.487 46.501 32.241 71 18l138-84c7.244-4.512 13.094-10.313 17-17 15.213-24.307 7.75-55.875-16-71l-139-85c-7.994-5.355-17.305-8-27-8z"/></svg>`,
            title: this.i18n.name || '媒体播放器',
            position: 'right',
            callback: (event: MouseEvent) => {
                const menu = new Menu();
                menu.addItem({ icon: 'iconSettings', label: this.i18n.settings?.title || '设置', click: () => this.openDialog() });
                menu.open({ x: event.clientX, y: event.clientY });
            }
        });
    }
    
    // Dialog设置面板
    private openDialog() {
        const dialog = new Dialog({
            title: this.i18n.settings?.title || '设置',
            content: `<div class="b3-dialog__content"><div class="dialog-content" style="display: flex; height: 100%;"></div></div><div class="b3-dialog__action" style="display: none;"></div>`,
            width: "500px", height: "600px",
            destroyCallback: () => {
                const comp = this.components.get('dialog-settings');
                if (comp?.$destroy) try { comp.$destroy(); } catch (e) {}
                this.components.delete('dialog-settings');
            }
        });
        
        const container = dialog.element.querySelector('.dialog-content') as HTMLElement;
        if (container) this.showTabContentInDialog('settings', container);
    }
    
    // 在Dialog中显示设置内容
    private showTabContentInDialog(tabId: string, container: HTMLElement) {
        const el = document.createElement('div');
        el.style.cssText = 'height: 100%; width: 100%; display: contents;';
        container.appendChild(el);
        
        const instance = new Setting({ 
            target: el, 
            props: { config: this.getConfig(), i18n: this.i18n, group: 'media-player', api: this.playerAPI }
        });
        this.components.set('dialog-settings', instance);
        
        instance.$on?.('changed', (e: CustomEvent<any>) => window.dispatchEvent(new CustomEvent('updatePlayerConfig', { detail: e.detail.settings })));
    }
    
    // 标签页内容管理
    private showTabContent(tabId: string, container: HTMLElement) {
        const components = { playlist: PlayList, assistant: Assistant, settings: Setting };
        
        // 切换显示已有组件
        container.querySelectorAll('[data-tab-id]').forEach(
            el => el.classList.toggle('fn__none', el.getAttribute('data-tab-id') !== tabId)
        );
        
        if (this.components.has(tabId)) {
            window.dispatchEvent(new CustomEvent('mediaPlayerTabActivate', { detail: { tabId } }));
            return;
        }
        
        // 创建新组件
        const el = document.createElement('div');
        el.setAttribute('data-tab-id', tabId);
        container.appendChild(el);
        
        const component = components[tabId];
        if (!component) return;
        
        // 组件属性配置
        const baseProps = { config: this.getConfig(), i18n: this.i18n, allTabs: ['playlist', 'assistant', 'settings'], activeTabId: tabId, api: this.playerAPI };
        const specificProps = {
            playlist: { currentItem: this.playerAPI?.getCurrentMedia?.() },
            settings: { group: 'media-player' },
            assistant: { 
                player: this.playerAPI, 
                currentMedia: this.playerAPI?.getCurrentMedia?.(),
                insertContentCallback: async (content) => {
                    const { doc } = await import('./core/document');
                    doc.insert(content, this.getConfig(), this.i18n);
                },
                createTimestampLinkCallback: this.playerAPI.createTimestampLink
            }
        };
        
        const instance = new component({ target: el, props: { ...baseProps, ...specificProps[tabId] } });
        this.components.set(tabId, instance);
        
        // 组件事件绑定
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
    
    // 播放器标签页
    private openTab() {
        const config = this.getConfig();
        const openMode = config?.settings?.openMode || 'default';
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

        // 标签页选项
        const tabOptions: any = {
            app: this.app,
            custom: { icon: "siyuan-media-player-icon", title: this.i18n.name, id: this.name + "custom_tab" }
        };
        
        if (openMode === 'right') tabOptions.position = 'right';
        else if (openMode === 'bottom') tabOptions.position = 'bottom';
        else if (openMode === 'window') tabOptions.custom.asWindow = true;
        
        openTab(tabOptions);
    }
    
    // 快捷键注册
    private registerHotkeys() {
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
                
                if (!this.components.get('player') || !this.playerAPI?.getCurrentMedia?.()) {
                    showMessage(this.i18n.openPlayer);
                    this.openTab();
                    return;
                }
                
                window.dispatchEvent(new CustomEvent('mediaPlayerAction', { detail: { action } }));
            }
        }));
    }
    
    // 用户脚本加载
    private async loadUserScripts() {
        document.querySelectorAll('[id^="media-player-script-"]').forEach(el => el.remove());
        
        try {
            if (!window.require || !window.siyuan?.config?.system?.workspaceDir) return;
            
            const fs = window.require('fs'), path = window.require('path');
            const dir = path.join(window.siyuan.config.system.workspaceDir, 'data/storage/petal/siyuan-media-player');
            
            (this.getConfig().settings.scripts || [])
                .filter(s => s.enabled)
                .forEach(s => {
                    const file = path.join(dir, s.name);
                    if (fs.existsSync(file)) {
                        document.head.appendChild(
                            Object.assign(document.createElement('script'), {
                                id: `media-player-script-${s.name}`,
                                textContent: fs.readFileSync(file, 'utf-8')
                            })
                        );
                    }
                });
        } catch (e) {}
    }
    
    // DOM元素等待工具
    private async waitForElement(selector: string, timeout = 2000): Promise<Element | null> {
        const element = document.querySelector(selector);
        if (element) return element;
        
        return new Promise<Element | null>(resolve => {
            const endTime = Date.now() + timeout;
            const checkInterval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element || Date.now() > endTime) {
                    clearInterval(checkInterval);
                    resolve(element);
                }
            }, 50);
        });
    }
}
