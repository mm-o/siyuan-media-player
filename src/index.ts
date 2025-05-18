import {
    Plugin,
    showMessage,
    openTab
} from "siyuan";
import "@/styles/components.scss";

// @ts-ignore
import Player from "./components/Player.svelte";
// @ts-ignore
import PlayList from "./components/PlayList.svelte";
// @ts-ignore
import Setting from "./components/Setting.svelte";
// @ts-ignore
import Assistant from "./components/Assistant.svelte";
import { ConfigManager } from "./core/config";
import { LinkHandler } from "./core/LinkHandler";
import { doc, link } from './core/utils';
import type { MediaItem, ComponentInstance } from './core/types';
import { createMediaPlayerAPI } from './api';
import { player as playerUtils, mediaNotes } from './core/utils';
import { playMedia } from './core/media';

/**
 * 思源笔记媒体播放器插件
 */
export default class MediaPlayerPlugin extends Plugin {
    // 核心管理器
    private configManager: ConfigManager;
    private linkHandler: LinkHandler;
    private readonly TAB_TYPE = "custom_tab";
    
    // 统一管理组件和状态
    private components = new Map<string, ComponentInstance>();
    private events = new Map<string, EventListener>();
    private currentItem: MediaItem = null;
    private loopStartTime: number = null;
    private tabInstance: any = null;
    
    // 对外API
    public api: any;
    public playerAPI: any;
    
    /**
     * 插件加载
     */
    async onload() {
        // 初始化配置和API
        this.configManager = new ConfigManager(this);
        await this.configManager.load();
        
        // 初始化API并注册事件
        this.initAPI();
        this.registerEvents([
            ['siyuanMediaPlayerUpdate', this.handlePlayerUpdate],
            ['addMediaToPlaylist', this.handleAddMedia],
            ['directMediaPlay', this.handleDirectMediaPlay],
            ['playMediaItem', this.handlePlayMediaItem],
            ['mediaPlayerAction', this.handleMediaAction],
            ['updatePlayerConfig', this.handleUpdateConfig],
            ['mediaPlayerTabChange', this.handleTabChange],
            ['mediaEnded', this.handleMediaEnded]
        ]);
        
        // 初始化链接处理
        this.linkHandler = new LinkHandler(this.configManager, () => this.openMediaPlayerTab());
        this.linkHandler.startListening();
        this.api = createMediaPlayerAPI(this.name, () => this.openMediaPlayerTab());
        
        // UI初始化
        this.addSidebar();
        this.registerHotkeys();
        setTimeout(() => this.addTopBarButtons(), 1000);
        
        // 加载用户脚本
        this.loadUserScripts();

        const playerContainer = this.getComponent('player')?.$$.container;
        if (playerContainer) {
            playerContainer.addEventListener('mediaError', async (event: Event) => {
                const detail = (event as CustomEvent).detail;
                if (detail?.error) {
                    console.error("[Player] 媒体错误:", detail.error);
                    showMessage(this.i18n.player?.error?.playFailed || "播放失败");
                }
            });
            
            // 添加媒体结束事件监听
            playerContainer.addEventListener('mediaEnded', async (event: Event) => {
                const detail = (event as CustomEvent).detail;
                const { loopPlaylist } = detail || {};
                
                if (loopPlaylist) {
                    const playlist = this.getComponent('playlist');
                    if (playlist?.playNext) {
                        await playlist.playNext();
                    }
                }
            });
        }
    }
    
    /**
     * 初始化API
     */
    private initAPI() {
        this.playerAPI = {
            seekTo: (time: number) => this.getComponent('player')?.seekTo?.(time),
            getCurrentTime: () => this.getComponent('player')?.getCurrentTime?.() || 0,
            getScreenshotDataURL: () => this.getComponent('player')?.getScreenshotDataURL?.() || Promise.resolve(null),
            setPlayTime: (start: number, end?: number) => this.getComponent('player')?.setPlayTime?.(start, end),
            setLoopSegment: (start: number, end: number) => this.getComponent('player')?.setPlayTime?.(start, end),
            setLoop: (isLoop: boolean, loopTimes?: number) => this.getComponent('player')?.setLoop?.(isLoop, loopTimes),
            updateConfig: (newConfig: any) => this.getComponent('player')?.updateConfig?.(newConfig),
            playMediaItem: (mediaItem: MediaItem) => this.playMediaItem(mediaItem),
            getCurrentMedia: () => this.currentItem,
            pause: () => this.getComponent('player')?.pause?.(),
            resume: () => this.getComponent('player')?.resume?.(),
            play: (url: string, options: any) => this.getComponent('player')?.play?.(url, options)
        };
    }
    
    /**
     * 注册事件
     */
    private registerEvents(events: [string, (e: CustomEvent) => void][]) {
        // 标准事件
        events.forEach(([event, handler]) => {
            const listener = handler.bind(this) as EventListener;
            this.events.set(event, listener);
            window.addEventListener(event, listener);
        });
        
        // 脚本重载事件，简化处理
        const reloadFn = () => this.loadUserScripts();
        window.addEventListener('reloadUserScripts', reloadFn);
        this.events.set('reloadUserScripts', reloadFn as unknown as EventListener);
    }
    
    /**
     * 组件管理
     */
    private getComponent(id: string): ComponentInstance | undefined {
        return this.components.get(id);
    }
    
    private addComponent(id: string, instance: ComponentInstance) {
        this.destroyComponent(id);
        this.components.set(id, instance);
        return instance;
    }
    
    private destroyComponent(id: string) {
        const component = this.components.get(id);
        if (component?.$destroy) {
            try { component.$destroy(); } 
            catch (e) { console.error(`组件 ${id} 销毁失败:`, e); }
            this.components.delete(id);
        }
    }
    
    /**
     * 添加侧边栏
     */
    private addSidebar() {
        this.addDock({
            type: "SiyuanMediaSidebar",
            config: {
                position: "RightBottom",
                size: { width: 300, height: 480 },
                icon: "iconVideo",
                title: this.i18n.sidebar?.title || "媒体助手"
            },
            data: { plugin: this },
            init: function() {
                (this.data.plugin as MediaPlayerPlugin).initDockUI(this.element);
            }
        });
    }
    
    /**
     * 添加顶部栏按钮
     */
    private addTopBarButtons() {
        const barSync = document.getElementById("barSync");
        if (!barSync) return;
        
        const config = this.configManager.getConfig();
        const topBarConfig = config.settings.topBarButtons || {};
        
        // 添加样式
        if (!document.getElementById('media-player-btn-style')) {
            document.head.appendChild(Object.assign(document.createElement('style'), {
                id: 'media-player-btn-style',
                textContent: `.media-btn{margin:0 4px}.media-btn:hover{color:var(--b3-theme-primary)}`
            }));
        }
        
        // 添加按钮
        [
            { id: 'Screenshot', key: 'screenshot' as const, icon: 'iconCamera' },
            { id: 'Timestamp', key: 'timestamp' as const, icon: 'iconClock' },
            { id: 'LoopSegment', key: 'loopSegment' as const, icon: 'iconRefresh' },
            { id: 'MediaNotes', key: 'mediaNotes' as const, icon: 'iconFile' }
        ].forEach(({id, key, icon}) => {
            if (topBarConfig[key] === false || document.getElementById(`media${id}`)) return;
            
            const btn = document.createElement('button');
            btn.id = `media${id}`;
            btn.className = 'toolbar__item media-btn';
            btn.setAttribute('aria-label', this.i18n.controlBar?.[key]?.name || key);
            btn.innerHTML = `<svg><use xlink:href="#${icon}"></use></svg>`;
            btn.addEventListener('click', () => this.triggerMediaAction(key));
            barSync.after(btn);
        });
    }
    
    /**
     * 打开媒体播放器标签
     */
    public openMediaPlayerTab() {
        const self = this;
        const openMode = this.configManager.getConfig()?.settings?.openMode || 'default';
        
        this.addTab({
            type: this.TAB_TYPE,
            init() {
                // 创建播放器区域
                const container = document.createElement("div");
                container.className = "media-player-container";
                
                const playerArea = document.createElement("div");
                playerArea.className = "player-area";
                playerArea.style.cssText = "width:100%;height:100%;position:relative;z-index:1;";
                
                const mediaPlayerTab = document.createElement("div");
                mediaPlayerTab.className = "media-player-tab";
                
                const contentArea = document.createElement("div");
                contentArea.className = "content-area";
                
                contentArea.appendChild(playerArea);
                mediaPlayerTab.appendChild(contentArea);
                container.appendChild(mediaPlayerTab);
                
                // 初始化播放器
                self.tabInstance = this;
                self.addComponent('player', new Player({
                    target: playerArea,
                    props: {
                        config: self.configManager.getConfig().settings,
                        i18n: self.i18n,
                        currentItem: self.currentItem,
                        api: self.playerAPI
                    }
                }));
                
                // 注册全局API
                (window as any).siyuanMediaPlayer = self.playerAPI;
                self.notifyUpdate();
                
                this.element.appendChild(container);
            },
            destroy() {
                self.destroyComponent('player');
                self.tabInstance = null;
                (window as any).siyuanMediaPlayer = null;
            }
        });

        // 打开选项
        const options: any = {
            app: this.app,
            custom: {
                icon: "iconVideo",
                title: this.i18n.name,
                id: this.name + this.TAB_TYPE
            }
        };
        
        if (openMode === 'right') options.position = 'right';
        else if (openMode === 'bottom') options.position = 'bottom';
        else if (openMode === 'window') options.asWindow = true;
        
        openTab(options);
    }
    
    /**
     * 初始化侧边栏UI
     */
    private initDockUI(container: HTMLElement) {
        container.classList.add('media-player-sidebar');
        
        const contentEl = document.createElement('div');
        contentEl.className = 'media-player-sidebar-content';
        container.appendChild(contentEl);
        
        // 默认显示播放列表
        this.showTabContent('playlist', contentEl);
    }
    
    /**
     * 显示标签内容
     */
    private showTabContent(tabId: string, container: HTMLElement) {
        const components = { playlist: PlayList, assistant: Assistant, settings: Setting };
        
        // 已有组件则激活并返回
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
        
        // 组件配置
        const props = { 
            configManager: this.configManager, 
            i18n: this.i18n,
            allTabs: ['playlist', 'assistant', 'settings'],
            activeTabId: tabId,
            api: this.playerAPI,
            ...(tabId === 'playlist' && { currentItem: this.currentItem }),
            ...(tabId === 'settings' && { group: 'media-player' }),
            ...(tabId === 'assistant' && { 
                player: this.playerAPI, 
                currentMedia: this.currentItem,
                insertContentCallback: content => doc.insert(content, this.configManager.getConfig(), this.i18n),
                createTimestampLinkCallback: this.createTimestampLink.bind(this)
            })
        };
        
        // 创建组件
        const component = components[tabId];
        if (!component) return;
        
        const instance = new component({ target: el, props });
        this.addComponent(tabId, instance);
        
        // 设置特定组件事件
        if (tabId === 'playlist') {
            instance.$on?.('play', (event: CustomEvent<any>) => {
                this.openMediaPlayerTab();
                this.currentItem = event.detail;
                setTimeout(() => window.dispatchEvent(new CustomEvent('playMediaItem', { detail: event.detail })), 300);
            });
            this.linkHandler?.setPlaylist(instance);
        } else if (tabId === 'settings') {
            instance.$on?.('changed', (event: CustomEvent<any>) => {
                this.refreshTopBarButtons();
                window.dispatchEvent(new CustomEvent('updatePlayerConfig', { detail: event.detail.settings }));
            });
        }
        
        window.dispatchEvent(new CustomEvent('mediaPlayerTabActivate', { detail: { tabId } }));
    }
    
    /**
     * 播放媒体和事件处理
     */
    private async playMediaItem(mediaItem: MediaItem): Promise<void> {
        if (!mediaItem) return;
        
        try {
            this.currentItem = mediaItem;
            
            await playMedia(
                mediaItem, 
                this.playerAPI, 
                this.configManager, 
                (item) => {
                    this.currentItem = item;
                    this.notifyUpdate();
                }, 
                this.i18n
            );
            
            // 等待播放器就绪后再设置时间戳和循环片段
            await new Promise(resolve => setTimeout(resolve, 600));
            
            if (mediaItem.startTime !== undefined) {
                const startTime = Number(mediaItem.startTime);
                if (mediaItem.endTime !== undefined) {
                    this.playerAPI.setPlayTime(startTime, Number(mediaItem.endTime));
                } else {
                    this.playerAPI.seekTo(startTime);
                }
            }
        } catch (error) {
            console.error("播放媒体失败:", error);
            showMessage(this.i18n.player?.error?.playFailed || "播放失败");
        }
    }
    
    private notifyUpdate(): void {
        window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', {
            detail: { player: this.playerAPI, currentItem: this.currentItem }
        }));
    }
    
    private async triggerMediaAction(actionType: 'screenshot' | 'mediaNotes' | 'timestamp' | 'loopSegment') {
        if (!this.getComponent('player') || !this.currentItem) {
            showMessage(this.i18n.openPlayer);
            this.openMediaPlayerTab();
            return;
        }
        
        window.dispatchEvent(new CustomEvent('mediaPlayerAction', {
            detail: { action: actionType, loopStartTime: this.loopStartTime }
        }));
    }
    
    public async createTimestampLink(isLoop = false, startTime?: number, endTime?: number, subtitleText?: string) {
        if (!this.playerAPI || !this.currentItem) return null;
        
        const config = await this.configManager.getConfig();
        const time = startTime ?? this.playerAPI.getCurrentTime();
        const loopEnd = isLoop ? (endTime ?? time + 3) : endTime;
        
        return link(this.currentItem, config, time, loopEnd, subtitleText);
    }
    
    // 统一管理事件处理函数
    private handleTabChange = (e: CustomEvent) => {
        const tabId = e.detail?.tabId;
        if (tabId) {
            const container = document.querySelector('.media-player-sidebar-content');
            if (container) this.showTabContent(tabId, container as HTMLElement);
        }
    }
    
    private handlePlayerUpdate = (e: CustomEvent<any>) => {
        const { currentItem } = e.detail;
        this.currentItem = currentItem;
        
        if (this.tabInstance?.parent?.updateTitle && this.currentItem?.title) {
            try { this.tabInstance.parent.updateTitle(this.currentItem.title); } catch {}
        }
        
        // 更新助手组件
        const assistant = this.getComponent('assistant');
        if (assistant?.$set) {
            assistant.$set({ currentMedia: this.currentItem });
        }
    }
    
    private handleAddMedia = (e: CustomEvent<any>) => {
        const playlist = this.getComponent('playlist');
        if (!playlist?.addMedia) return;
        
        const { url, autoPlay = true, ...options } = e.detail || {};
        playlist.addMedia(url, { autoPlay, ...options });
        
        if (autoPlay) this.openMediaPlayerTab();
    }
    
    private handleDirectMediaPlay = (e: CustomEvent<any>) => {
        this.openMediaPlayerTab();
        
        setTimeout(() => {
            const item = e.detail;
            if (!item) return;
            
            this.currentItem = item;
            window.dispatchEvent(new CustomEvent('playMediaItem', { detail: item }));
            
            const playlist = this.getComponent('playlist');
            if (playlist?.$set) playlist.$set({ currentItem: item });
        }, 300);
    }
    
    private handlePlayMediaItem = (e: CustomEvent<any>) => {
        this.playMediaItem(e.detail);
    }
    
    private handleMediaAction = async (e: CustomEvent<any>) => {
        const { action, loopStartTime } = e.detail;
        if (!this.getComponent('player') || !this.currentItem) return;
        
        try {
            const settings = this.configManager.getConfig();
            
            switch (action) {
                case 'loopSegment': {
                    const newLoopStartTime = loopStartTime === null
                        ? this.playerAPI.getCurrentTime()
                        : await playerUtils.loop(this.playerAPI, this.currentItem, settings, this.i18n, loopStartTime);
                    
                    this.loopStartTime = newLoopStartTime;
                    window.dispatchEvent(new CustomEvent('loopSegmentResponse', {
                        detail: { loopStartTime: newLoopStartTime }
                    }));
                    break;
                }
                case 'mediaNotes':
                    await mediaNotes.create(this.currentItem, settings, this.playerAPI, this.i18n);
                    break;
                case 'screenshot':
                    await playerUtils.screenshot(this.playerAPI, this.currentItem, settings, this.i18n);
                    break;
                case 'timestamp':
                    await playerUtils.timestamp(this.playerAPI, this.currentItem, settings, this.i18n);
                    break;
            }
        } catch (error) {
            console.error(`${action} 操作失败:`, error);
            showMessage(this.i18n.controlBar?.[action]?.error || `${action} 操作失败`);
        }
    }
    
    private handleUpdateConfig = (e: CustomEvent<any>) => {
        if (this.playerAPI?.updateConfig) {
            this.playerAPI.updateConfig(e.detail);
        }
        
        // 重新加载用户脚本
        this.loadUserScripts();
    }
    
    private handleMediaEnded = ({ detail }) => {
        if (detail?.loopPlaylist) {
            const playlist = this.getComponent('playlist');
            if (playlist?.playNext) {
                playlist.playNext();
            }
        }
    }
    
    /**
     * 其他工具函数
     */
    private registerHotkeys() {
        [
            ['screenshot', this.i18n.screenshot?.text],
            ['timestamp', this.i18n.timestamp?.text],
            ['loopSegment', this.i18n.loopSegment?.text],
            ['mediaNotes', this.i18n.controlBar?.mediaNotes?.name]
        ].forEach(([key, text]) => this.addCommand({
            langKey: key,
            langText: text as string,
            hotkey: "",
            callback: () => this.triggerMediaAction(key as any)
        }));
    }

    private refreshTopBarButtons() {
        ['mediaScreenshot', 'mediaTimestamp', 'mediaLoopSegment', 'mediaMediaNotes']
            .forEach(id => document.getElementById(id)?.remove());
        this.addTopBarButtons();
    }
    
    /**
     * 卸载插件
     */
    onunload() {
        // 清理事件和组件
        this.events.forEach((handler, event) => window.removeEventListener(event, handler));
        this.components.forEach((_, id) => this.destroyComponent(id));
        
        // 清理状态
        this.currentItem = null;
        this.loopStartTime = null;
        this.tabInstance = null;
        this.playerAPI = null;
        (window as any).siyuanMediaPlayer = null;
        
        // 停止链接处理
        this.linkHandler?.stopListening();
        
        // 移除UI元素
        ['mediaScreenshot', 'mediaTimestamp', 'mediaLoopSegment', 'mediaMediaNotes', 'media-player-btn-style']
            .forEach(id => document.getElementById(id)?.remove());
            
        // 清理用户脚本
        document.querySelectorAll('[id^="media-player-script-"]').forEach(el => el.remove());
    }

    /**
     * 加载用户自定义脚本
     */
    private async loadUserScripts() {
        // 先清理现有脚本
        document.querySelectorAll('[id^="media-player-script-"]').forEach(el => el.remove());
        
        try {
            // 检查环境
            if (!window.require || !window.siyuan?.config?.system?.workspaceDir) return;
            
            // 获取脚本文件
            const fs = window.require('fs'), path = window.require('path');
            const dir = path.join(window.siyuan.config.system.workspaceDir, 'data/storage/petal/siyuan-media-player');
            
            // 过滤已启用脚本并加载
            (this.configManager.getConfig().settings.scripts || [])
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
}
